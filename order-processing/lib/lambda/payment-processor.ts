/**
 * Payment Processor - Mock payment authorization
 *
 * Stand-in for a real payment gateway integration: always approves the
 * charge. Invoked durably via context.invoke() from the order processor, so
 * swapping this for a real gateway call (Stripe/Braintree/etc.) later won't
 * require changing the caller.
 */

import { DurableContext, withDurableExecution } from '@aws/durable-execution-sdk-js';
import { Order, PaymentResult } from './types';

export const handler = withDurableExecution(
    async (event: Order, context: DurableContext): Promise<PaymentResult> => {
        context.logger.info('Payment processor invoked', { order: event });

        return context.step('authorize-payment', async (stepCtx) => {
            stepCtx.logger.info('Mock payment authorized', { orderId: event.orderId, amount: event.amount });

            return {
                paymentApproved: true,
                orderId: event.orderId,
                customerId: event.customerId,
                amount: event.amount ?? 0,
                timestamp: new Date().toISOString(),
            };
        });
    }
);
