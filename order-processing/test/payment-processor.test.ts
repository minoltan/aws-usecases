import { LocalDurableTestRunner } from '@aws/durable-execution-sdk-js-testing';
import { handler as paymentProcessor } from '../lib/lambda/payment-processor';

describe('Payment Processor', () => {
    beforeAll(() => LocalDurableTestRunner.setupTestEnvironment({ skipTime: true }));
    afterAll(() => LocalDurableTestRunner.teardownTestEnvironment());

    const validOrder = {
        orderId: 'ORD-123',
        customerId: 'CUST-456',
        items: [{ productId: 'PROD-1', quantity: 2 }],
        amount: 99.99
    };

    it('auto-approves payment without any callback', async () => {
        const runner = new LocalDurableTestRunner({
            handlerFunction: paymentProcessor,
        });

        const execution = await runner.run({ payload: validOrder });
        const result = execution.getResult() as any;

        expect(result.paymentApproved).toBe(true);
        expect(result.orderId).toBe('ORD-123');
        expect(result.customerId).toBe('CUST-456');
        expect(result.amount).toBe(99.99);
        expect(result.timestamp).toBeDefined();
        expect(result.reason).toBeUndefined();
    });

    it('defaults amount to 0 when the order has no computed amount', async () => {
        const runner = new LocalDurableTestRunner({
            handlerFunction: paymentProcessor,
        });

        const execution = await runner.run({
            payload: { orderId: 'ORD-456', customerId: 'CUST-789', items: [{ productId: 'PROD-1', quantity: 1 }] },
        });
        const result = execution.getResult() as any;

        expect(result.paymentApproved).toBe(true);
        expect(result.amount).toBe(0);
    });
});
