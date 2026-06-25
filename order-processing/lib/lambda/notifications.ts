/**
 * SNS notifications for order status changes.
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DurableContextLogger, DurableLogger } from '@aws/durable-execution-sdk-js';
import { OrderResult } from './types';

const snsClient = new SNSClient({});

/**
 * Publishes the final order result to the order status SNS topic.
 * No-op if ORDER_STATUS_TOPIC_ARN is not configured.
 */
export async function publishOrderStatus(
    result: OrderResult,
    stepCtx?: DurableContextLogger<DurableLogger>
): Promise<void> {
    const topicArn = process.env.ORDER_STATUS_TOPIC_ARN;
    if (!topicArn) {
        return;
    }

    stepCtx?.info('Publishing order status notification', { orderId: result.orderId, status: result.status });

    await snsClient.send(new PublishCommand({
        TopicArn: topicArn,
        Subject: `Order ${result.orderId}: ${result.status}`,
        Message: JSON.stringify(result),
        MessageAttributes: {
            status: {
                DataType: 'String',
                StringValue: result.status,
            },
        },
    }));
}
