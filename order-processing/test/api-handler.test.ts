process.env.ORDER_PROCESSOR_FUNCTION_NAME = 'order-processor:$LATEST';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-lambda', () => {
    class FakeCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    return {
        LambdaClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
        InvokeCommand: FakeCommand,
        SendDurableExecutionCallbackSuccessCommand: FakeCommand,
    };
});

jest.mock('../lib/lambda/order-store');

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../lib/lambda/api-handler';
import * as orderStore from '../lib/lambda/order-store';

const mockedOrderStore = orderStore as jest.Mocked<typeof orderStore>;

function makeEvent(
    method: string,
    path: string,
    body?: unknown,
    pathParameters?: Record<string, string>
): APIGatewayProxyEvent {
    return {
        path,
        pathParameters,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        httpMethod: method,
    } as unknown as APIGatewayProxyEvent;
}

function parseBody(response: APIGatewayProxyResult): any {
    return JSON.parse((response as { body: string }).body);
}

describe('api-handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /orders', () => {
        it('submits an order and creates a DynamoDB record', async () => {
            mockSend.mockResolvedValue({ DurableExecutionArn: 'arn:exec-1' });
            mockedOrderStore.createOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                customerId: 'CUST-1',
                amount: 10,
                status: 'PROCESSING',
                createdAt: 'now',
                updatedAt: 'now',
            });

            const event = makeEvent('POST', '/orders', { customerId: 'CUST-1', amount: 10 });
            const response = (await handler(event)) as { statusCode: number; body: string };

            expect(response.statusCode).toBe(202);
            const body = parseBody(response);
            expect(body.status).toBe('PROCESSING');
            expect(body.executionArn).toBe('arn:exec-1');

            // Response reflects the record returned by createOrderRecord (mocked above)
            expect(body.orderId).toBe('ORD-1');

            // The DynamoDB record is claimed (conditionally) before the Lambda invoke happens
            const [orderId, customerId, amount, executionArnAtCreate] = mockedOrderStore.createOrderRecord.mock.calls[0];
            expect(orderId).toMatch(/^ORD-/);
            expect(customerId).toBe('CUST-1');
            expect(amount).toBe(10);
            expect(executionArnAtCreate).toBeUndefined();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const invokeInput = mockSend.mock.calls[0][0].input;
            expect(invokeInput.FunctionName).toBe('order-processor:$LATEST');
            expect(invokeInput.InvocationType).toBe('Event');
            expect(invokeInput.DurableExecutionName).toBe(`order-${orderId}`);

            // The execution ARN learned from the invoke is persisted afterward
            expect(mockedOrderStore.updateOrderProgress).toHaveBeenCalledWith(orderId, { executionArn: 'arn:exec-1' });
        });

        it('returns 400 when customerId or amount is missing', async () => {
            const event = makeEvent('POST', '/orders', { customerId: 'CUST-1' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(400);
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('returns 409 when orderId already exists, without invoking order-processor', async () => {
            const conflictError = Object.assign(new Error('conditional check failed'), {
                name: 'ConditionalCheckFailedException',
            });
            mockedOrderStore.createOrderRecord.mockRejectedValue(conflictError);
            mockedOrderStore.getOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                status: 'PAYMENT_PENDING',
                createdAt: 'a',
                updatedAt: 'b',
            });

            const event = makeEvent('POST', '/orders', { orderId: 'ORD-1', customerId: 'CUST-1', amount: 10 });
            const response = (await handler(event)) as { statusCode: number; body: string };

            expect(response.statusCode).toBe(409);
            expect(parseBody(response).message).toContain('PAYMENT_PENDING');
            expect(mockSend).not.toHaveBeenCalled();
        });
    });

    describe('GET /orders/{orderId}', () => {
        it('returns the order record when found', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                status: 'PAYMENT_COMPLETED',
                createdAt: 'a',
                updatedAt: 'b',
            });

            const event = makeEvent('GET', '/orders/ORD-1', undefined, { orderId: 'ORD-1' });
            const response = (await handler(event)) as { statusCode: number; body: string };

            expect(response.statusCode).toBe(200);
            expect(parseBody(response).status).toBe('PAYMENT_COMPLETED');
        });

        it('returns 404 when the order does not exist', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue(undefined);

            const event = makeEvent('GET', '/orders/missing', undefined, { orderId: 'missing' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(404);
        });
    });

    describe('POST /orders/{orderId}/approval', () => {
        it('sends the callback and marks the order APPROVAL_SUBMITTED', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                status: 'AWAITING_APPROVAL',
                callbackId: 'cb-1',
                createdAt: 'a',
                updatedAt: 'b',
            });
            mockSend.mockResolvedValue({});

            const event = makeEvent('POST', '/orders/ORD-1/approval', { approved: true }, { orderId: 'ORD-1' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(200);
            expect(mockSend).toHaveBeenCalledTimes(1);
            const callbackInput = mockSend.mock.calls[0][0].input;
            expect(callbackInput.CallbackId).toBe('cb-1');
            expect(mockedOrderStore.updateOrderProgress).toHaveBeenCalledWith('ORD-1', { status: 'APPROVAL_SUBMITTED' });
        });

        it('returns 409 when the order is not awaiting approval', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                status: 'PROCESSING',
                createdAt: 'a',
                updatedAt: 'b',
            });

            const event = makeEvent('POST', '/orders/ORD-1/approval', { approved: true }, { orderId: 'ORD-1' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(409);
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('returns 404 when the order does not exist', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue(undefined);

            const event = makeEvent('POST', '/orders/missing/approval', { approved: true }, { orderId: 'missing' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(404);
        });
    });
});
