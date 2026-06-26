/**
 * Order record persistence in DynamoDB.
 *
 * Provides a permanent system of record for orders that survives past the
 * durable execution's retention period, and lets the API expose status
 * without calling Lambda's durable-execution control-plane APIs directly.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DurableContextLogger, DurableLogger } from '@aws/durable-execution-sdk-js';
import { CompensationAction, OrderItem, OrderRecord, OrderResult, OrderTrackingStatus } from './types';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

function tableName(): string {
    const name = process.env.ORDERS_TABLE_NAME;
    if (!name) {
        throw new Error('ORDERS_TABLE_NAME environment variable is not set');
    }
    return name;
}

/**
 * Creates the initial order record when an order is submitted via the API.
 *
 * The write is conditional on orderId not already existing, so that
 * resubmitting the same orderId fails fast with ConditionalCheckFailedException
 * instead of silently overwriting an in-flight or completed order and starting
 * a second durable execution under the same DurableExecutionName.
 */
export async function createOrderRecord(
    orderId: string,
    customerId: string,
    items: OrderItem[],
    executionArn: string | undefined
): Promise<OrderRecord> {
    const now = new Date().toISOString();
    const record: OrderRecord = {
        orderId,
        customerId,
        items,
        status: 'PROCESSING',
        executionArn,
        createdAt: now,
        updatedAt: now,
    };

    await docClient.send(new PutCommand({
        TableName: tableName(),
        Item: record,
        ConditionExpression: 'attribute_not_exists(orderId)',
    }));

    return record;
}

/**
 * Applies a partial, intermediate update to an order record (e.g. moving to
 * PAYMENT_PENDING with the server-computed amount after inventory reservation,
 * or flagging cancelRequested when the cancel API is called).
 */
export async function updateOrderProgress(
    orderId: string,
    fields: Partial<Pick<OrderRecord, 'status' | 'reservationId' | 'executionArn' | 'amount' | 'cancelRequested'>>,
    stepCtx?: DurableContextLogger<DurableLogger>
): Promise<void> {
    const updatedAt = new Date().toISOString();
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, unknown> = { ':updatedAt': updatedAt };
    const sets: string[] = ['#updatedAt = :updatedAt'];

    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        names[`#${key}`] = key;
        values[`:${key}`] = value;
        sets.push(`#${key} = :${key}`);
    }

    stepCtx?.info('Updating order progress', { orderId, fields });

    await docClient.send(new UpdateCommand({
        TableName: tableName(),
        Key: { orderId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
    }));
}

/**
 * Writes the final order result to DynamoDB once the durable workflow
 * reaches a terminal state.
 */
export async function finalizeOrder(orderId: string, result: OrderResult): Promise<void> {
    const updatedAt = new Date().toISOString();

    const fields: Record<string, unknown> = {
        status: result.status,
        message: result.message,
        updatedAt,
    };
    if (result.validationResult !== undefined) fields.validationResult = result.validationResult;
    if (result.reservationId !== undefined) fields.reservationId = result.reservationId;
    if (result.compensationActions !== undefined) fields.compensationActions = result.compensationActions;

    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
        names[`#${key}`] = key;
        values[`:${key}`] = value;
        sets.push(`#${key} = :${key}`);
    }

    await docClient.send(new UpdateCommand({
        TableName: tableName(),
        Key: { orderId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
    }));
}

/**
 * Fetches an order record. Returns undefined if no order exists with that ID.
 */
export async function getOrderRecord(orderId: string): Promise<OrderRecord | undefined> {
    const response = await docClient.send(new GetCommand({
        TableName: tableName(),
        Key: { orderId },
    }));

    return response.Item as OrderRecord | undefined;
}

export type { OrderRecord, OrderTrackingStatus, CompensationAction };
