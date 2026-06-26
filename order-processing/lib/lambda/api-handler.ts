/**
 * API Handler - HTTP front door for the order processing workflow
 *
 * Routes (REST API, Lambda proxy integration):
 *   POST /orders                   - submit a new order
 *   GET  /orders/{orderId}          - check order status
 *   POST /orders/{orderId}/cancel   - request cancellation before processing proceeds
 *
 * This is a plain Lambda (not a durable function) that fronts the durable
 * order-processor/payment-processor workflow: it starts executions and
 * reads/writes order status in DynamoDB.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';
import { createOrderRecord, getOrderRecord, updateOrderProgress } from './order-store';
import { Order, OrderItem, OrderTrackingStatus } from './types';

const lambdaClient = new LambdaClient({});

// Cancellation only has an effect while the order is still in PROCESSING - the
// workflow's check-cancellation step runs once, early, before reserving
// inventory or charging payment. Once it has passed that point, requesting
// cancellation here wouldn't actually stop anything.
const CANCELLABLE_STATUSES: OrderTrackingStatus[] = ['PROCESSING'];

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function parseBody<T>(event: APIGatewayProxyEvent): T | undefined {
    if (!event.body) return undefined;
    try {
        return JSON.parse(event.body) as T;
    } catch {
        return undefined;
    }
}

function isValidItems(items: unknown): items is OrderItem[] {
    return Array.isArray(items) && items.length > 0 && items.every(
        (item) => item && typeof item.productId === 'string' && typeof item.quantity === 'number' && item.quantity > 0
    );
}

async function submitOrder(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body = parseBody<Partial<Order> & { orderId?: string }>(event);
    if (!body || !body.customerId || !isValidItems(body.items)) {
        return jsonResponse(400, { message: 'customerId and a non-empty items array ({ productId, quantity }) are required' });
    }

    const orderId = body.orderId || `ORD-${randomUUID()}`;
    const order: Order = {
        orderId,
        customerId: body.customerId,
        items: body.items,
    };

    // Claim the orderId before starting any execution, so a resubmitted orderId
    // is rejected here instead of silently overwriting the existing record and
    // colliding on DurableExecutionName below.
    let record;
    try {
        record = await createOrderRecord(orderId, order.customerId, order.items, undefined);
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            const existing = await getOrderRecord(orderId);
            return jsonResponse(409, { message: `Order ${orderId} already exists (status: ${existing?.status ?? 'unknown'})` });
        }
        throw error;
    }

    const functionName = process.env.ORDER_PROCESSOR_FUNCTION_NAME;
    if (!functionName) {
        throw new Error('ORDER_PROCESSOR_FUNCTION_NAME environment variable is not set');
    }

    const invokeResponse = await lambdaClient.send(new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        DurableExecutionName: `order-${orderId}`,
        Payload: Buffer.from(JSON.stringify(order)),
    }));

    await updateOrderProgress(orderId, { executionArn: invokeResponse.DurableExecutionArn });

    return jsonResponse(202, {
        orderId: record.orderId,
        status: record.status,
        executionArn: invokeResponse.DurableExecutionArn,
    });
}

async function getOrderStatus(orderId: string): Promise<APIGatewayProxyResult> {
    const record = await getOrderRecord(orderId);
    if (!record) {
        return jsonResponse(404, { message: `No order found with orderId ${orderId}` });
    }
    return jsonResponse(200, record);
}

async function requestCancellation(orderId: string): Promise<APIGatewayProxyResult> {
    const record = await getOrderRecord(orderId);
    if (!record) {
        return jsonResponse(404, { message: `No order found with orderId ${orderId}` });
    }
    if (!CANCELLABLE_STATUSES.includes(record.status)) {
        return jsonResponse(409, { message: `Order ${orderId} can no longer be cancelled (status: ${record.status})` });
    }

    await updateOrderProgress(orderId, { cancelRequested: true });

    return jsonResponse(200, { orderId, message: 'Cancellation requested' });
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const method = event.httpMethod;
    const orderId = event.pathParameters?.orderId;

    try {
        if (method === 'POST' && !orderId) {
            return await submitOrder(event);
        }
        if (method === 'GET' && orderId) {
            return await getOrderStatus(orderId);
        }
        if (method === 'POST' && orderId && event.path.endsWith('/cancel')) {
            return await requestCancellation(orderId);
        }
        return jsonResponse(404, { message: 'Not found' });
    } catch (error) {
        console.error('Unhandled error in api-handler', error);
        return jsonResponse(500, { message: error instanceof Error ? error.message : String(error) });
    }
};
