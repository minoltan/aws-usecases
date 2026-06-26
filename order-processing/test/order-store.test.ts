// Mock the AWS SDK clients before importing the module under test
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: class {},
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
    class FakeCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    return {
        DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
        PutCommand: FakeCommand,
        GetCommand: FakeCommand,
        UpdateCommand: FakeCommand,
    };
});

import { createOrderRecord, getOrderRecord, updateOrderProgress, finalizeOrder } from '../lib/lambda/order-store';
import { OrderResult } from '../lib/lambda/types';

describe('order-store', () => {
    beforeEach(() => {
        mockSend.mockReset();
        process.env.ORDERS_TABLE_NAME = 'test-orders-table';
    });

    describe('createOrderRecord', () => {
        it('puts a new item with PROCESSING status', async () => {
            mockSend.mockResolvedValue({});

            const items = [{ productId: 'PROD-1', quantity: 2 }];
            const record = await createOrderRecord('ORD-1', 'CUST-1', items, 'arn:aws:lambda:us-east-1:123:execution:exec-1');

            expect(record.status).toBe('PROCESSING');
            expect(record.orderId).toBe('ORD-1');
            expect(mockSend).toHaveBeenCalledTimes(1);

            const input = mockSend.mock.calls[0][0].input;
            expect(input.TableName).toBe('test-orders-table');
            expect(input.Item).toMatchObject({
                orderId: 'ORD-1',
                customerId: 'CUST-1',
                items,
                status: 'PROCESSING',
                executionArn: 'arn:aws:lambda:us-east-1:123:execution:exec-1',
            });
        });
    });

    describe('getOrderRecord', () => {
        it('returns undefined when no item exists', async () => {
            mockSend.mockResolvedValue({});

            const record = await getOrderRecord('missing');

            expect(record).toBeUndefined();
        });

        it('returns the stored item', async () => {
            mockSend.mockResolvedValue({ Item: { orderId: 'ORD-1', status: 'PROCESSING' } });

            const record = await getOrderRecord('ORD-1');

            expect(record?.status).toBe('PROCESSING');
            const input = mockSend.mock.calls[0][0].input;
            expect(input.Key).toEqual({ orderId: 'ORD-1' });
        });
    });

    describe('updateOrderProgress', () => {
        it('builds an UpdateExpression covering the provided fields', async () => {
            mockSend.mockResolvedValue({});

            await updateOrderProgress('ORD-1', { status: 'PAYMENT_PENDING', amount: 49.99 });

            const input = mockSend.mock.calls[0][0].input;
            expect(input.Key).toEqual({ orderId: 'ORD-1' });
            expect(input.ExpressionAttributeValues[':status']).toBe('PAYMENT_PENDING');
            expect(input.ExpressionAttributeValues[':amount']).toBe(49.99);
            expect(input.UpdateExpression).toContain('#status = :status');
            expect(input.UpdateExpression).toContain('#amount = :amount');
        });
    });

    describe('finalizeOrder', () => {
        it('writes the terminal status and message from the order result', async () => {
            mockSend.mockResolvedValue({});

            const result: OrderResult = {
                status: 'PAYMENT_COMPLETED',
                orderId: 'ORD-1',
                message: 'Order completed successfully.',
                processingTime: { orderReceived: '2025-01-01T00:00:00.000Z', orderCompleted: '2025-01-01T00:00:01.000Z' },
            };

            await finalizeOrder('ORD-1', result);

            const input = mockSend.mock.calls[0][0].input;
            expect(input.ExpressionAttributeValues[':status']).toBe('PAYMENT_COMPLETED');
            expect(input.ExpressionAttributeValues[':message']).toBe('Order completed successfully.');
        });
    });

    describe('missing table configuration', () => {
        it('throws a clear error when ORDERS_TABLE_NAME is not set', async () => {
            delete process.env.ORDERS_TABLE_NAME;

            await expect(getOrderRecord('ORD-1')).rejects.toThrow('ORDERS_TABLE_NAME');
        });
    });
});
