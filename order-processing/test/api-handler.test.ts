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
            const items = [{ productId: 'PROD-1', quantity: 2 }];
            mockedOrderStore.createOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                customerId: 'CUST-1',
                items,
                status: 'PROCESSING',
                createdAt: 'now',
                updatedAt: 'now',
            });

            const event = makeEvent('POST', '/orders', { customerId: 'CUST-1', items });
            const response = (await handler(event)) as { statusCode: number; body: string };

            expect(response.statusCode).toBe(202);
            const body = parseBody(response);
            expect(body.status).toBe('PROCESSING');
            expect(body.executionArn).toBe('arn:exec-1');

            // Response reflects the record returned by createOrderRecord (mocked above)
            expect(body.orderId).toBe('ORD-1');

            // The DynamoDB record is claimed (conditionally) before the Lambda invoke happens
            const [orderId, customerId, createdItems, executionArnAtCreate] = mockedOrderStore.createOrderRecord.mock.calls[0];
            expect(orderId).toMatch(/^ORD-/);
            expect(customerId).toBe('CUST-1');
            expect(createdItems).toEqual(items);
            expect(executionArnAtCreate).toBeUndefined();

            expect(mockSend).toHaveBeenCalledTimes(1);
            const invokeInput = mockSend.mock.calls[0][0].input;
            expect(invokeInput.FunctionName).toBe('order-processor:$LATEST');
            expect(invokeInput.InvocationType).toBe('Event');
            expect(invokeInput.DurableExecutionName).toBe(`order-${orderId}`);

            // The execution ARN learned from the invoke is persisted afterward
            expect(mockedOrderStore.updateOrderProgress).toHaveBeenCalledWith(orderId, { executionArn: 'arn:exec-1' });
        });

        it('returns 400 when customerId or items is missing', async () => {
            const event = makeEvent('POST', '/orders', { customerId: 'CUST-1' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(400);
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('returns 400 when items is an empty array', async () => {
            const event = makeEvent('POST', '/orders', { customerId: 'CUST-1', items: [] });
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

            const event = makeEvent('POST', '/orders', {
                orderId: 'ORD-1',
                customerId: 'CUST-1',
                items: [{ productId: 'PROD-1', quantity: 2 }],
            });
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

    describe('POST /orders/{orderId}/cancel', () => {
        it('flags cancelRequested while the order is still PROCESSING', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                status: 'PROCESSING',
                createdAt: 'a',
                updatedAt: 'b',
            });

            const event = makeEvent('POST', '/orders/ORD-1/cancel', undefined, { orderId: 'ORD-1' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(200);
            expect(mockedOrderStore.updateOrderProgress).toHaveBeenCalledWith('ORD-1', { cancelRequested: true });
        });

        it('returns 409 once the order has moved past PROCESSING', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue({
                orderId: 'ORD-1',
                status: 'PAYMENT_PENDING',
                createdAt: 'a',
                updatedAt: 'b',
            });

            const event = makeEvent('POST', '/orders/ORD-1/cancel', undefined, { orderId: 'ORD-1' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(409);
            expect(mockedOrderStore.updateOrderProgress).not.toHaveBeenCalled();
        });

        it('returns 404 when the order does not exist', async () => {
            mockedOrderStore.getOrderRecord.mockResolvedValue(undefined);

            const event = makeEvent('POST', '/orders/missing/cancel', undefined, { orderId: 'missing' });
            const response = (await handler(event)) as { statusCode: number };

            expect(response.statusCode).toBe(404);
        });
    });
});
