/**
 * API Handler - HTTP front door for the order processing workflow
 *
 * Routes (REST API, Lambda proxy integration):
 *   POST /orders                    - submit a new order
 *   GET  /orders/{orderId}           - check order status
 *   POST /orders/{orderId}/approval  - approve or reject a pending payment
 *
 * This is a plain Lambda (not a durable function) that fronts the durable
 * order-processor/payment-processor workflow: it starts executions, reads
 * order status from DynamoDB, and forwards approval decisions to the
 * payment processor's open callback.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaClient, InvokeCommand, SendDurableExecutionCallbackSuccessCommand } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';
import { createOrderRecord, getOrderRecord, updateOrderProgress } from './order-store';
import { Order } from './types';

const lambdaClient = new LambdaClient({});

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

async function submitOrder(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body = parseBody<Partial<Order>>(event);
    if (!body || !body.customerId || body.amount === undefined) {
        return jsonResponse(400, { message: 'customerId and amount are required' });
    }

    const orderId = body.orderId || `ORD-${randomUUID()}`;
    const order: Order = { orderId, customerId: body.customerId, amount: body.amount };

    // Claim the orderId before starting any execution, so a resubmitted orderId
    // is rejected here instead of silently overwriting the existing record and
    // colliding on DurableExecutionName below.
    let record;
    try {
        record = await createOrderRecord(orderId, order.customerId, order.amount, undefined);
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

async function submitApproval(orderId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const body = parseBody<{ approved: boolean; reason?: string }>(event);
    if (!body || typeof body.approved !== 'boolean') {
        return jsonResponse(400, { message: 'approved (boolean) is required' });
    }

    const record = await getOrderRecord(orderId);
    if (!record) {
        return jsonResponse(404, { message: `No order found with orderId ${orderId}` });
    }
    if (record.status !== 'AWAITING_APPROVAL' || !record.callbackId) {
        return jsonResponse(409, { message: `Order ${orderId} is not awaiting approval (status: ${record.status})` });
    }

    await lambdaClient.send(new SendDurableExecutionCallbackSuccessCommand({
        CallbackId: record.callbackId,
        Result: Buffer.from(JSON.stringify({ approved: body.approved, reason: body.reason })),
    }));

    await updateOrderProgress(orderId, { status: 'APPROVAL_SUBMITTED' });

    return jsonResponse(200, { orderId, status: 'APPROVAL_SUBMITTED' });
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
        if (method === 'POST' && orderId && event.path.endsWith('/approval')) {
            return await submitApproval(orderId, event);
        }
        return jsonResponse(404, { message: 'Not found' });
    } catch (error) {
        console.error('Unhandled error in api-handler', error);
        return jsonResponse(500, { message: error instanceof Error ? error.message : String(error) });
    }
};
