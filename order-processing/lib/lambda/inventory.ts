/**
 * Inventory management backed by DynamoDB.
 *
 * Stock is stored one item per product (partition key productId, attributes
 * quantity and price). Reservation prices the order from the catalog (never
 * trusting a client-supplied amount) and then atomically decrements every
 * line item's stock in a single transaction - either every item has enough
 * stock and all are reserved, or none are. Release credits the reserved
 * quantities back the same way.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DurableContextLogger, DurableLogger } from '@aws/durable-execution-sdk-js';
import { Order, OrderItem, ReservationResult } from './types';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

function tableName(): string {
    const name = process.env.INVENTORY_TABLE_NAME;
    if (!name) {
        throw new Error('INVENTORY_TABLE_NAME environment variable is not set');
    }
    return name;
}

/**
 * Looks up the current catalog price for each line item and sums price *
 * quantity. Throws if a product doesn't exist in the inventory table.
 */
async function priceItems(items: OrderItem[]): Promise<number> {
    const prices = await Promise.all(items.map(async (item) => {
        const response = await docClient.send(new GetCommand({
            TableName: tableName(),
            Key: { productId: item.productId },
        }));
        if (!response.Item) {
            throw new Error(`Unknown product ${item.productId}`);
        }
        return (response.Item.price as number) * item.quantity;
    }));

    return prices.reduce((sum, lineTotal) => sum + lineTotal, 0);
}

/**
 * Reserves inventory for an order: prices it from the catalog, then
 * atomically decrements stock for every line item in one transaction.
 * Throws if there isn't enough stock for any item; the caller's saga treats
 * that the same as any other step failure (no compensation needed, since
 * nothing was reserved).
 */
export async function reserveInventory(
    order: Order,
    stepCtx: DurableContextLogger<DurableLogger>
): Promise<ReservationResult> {
    const reservationId = `RSV-${order.orderId}`;
    const timestamp = new Date().toISOString();

    const amount = await priceItems(order.items);

    try {
        await docClient.send(new TransactWriteCommand({
            TransactItems: order.items.map((item) => ({
                Update: {
                    TableName: tableName(),
                    Key: { productId: item.productId },
                    UpdateExpression: 'SET quantity = quantity - :requested',
                    ConditionExpression: 'quantity >= :requested',
                    ExpressionAttributeValues: { ':requested': item.quantity },
                },
            })),
        }));
    } catch (error: any) {
        if (error.name === 'TransactionCanceledException') {
            throw new Error(`Insufficient inventory for order ${order.orderId}`);
        }
        throw error;
    }

    stepCtx.info('Inventory reserved', {
        reservationId,
        orderId: order.orderId,
        items: order.items,
        amount,
        timestamp,
    });

    return {
        reservationId,
        orderId: order.orderId,
        items: order.items,
        amount,
        timestamp,
    };
}

/**
 * Releases a previously reserved inventory allocation (saga compensation),
 * crediting every reserved line item's quantity back in one transaction.
 */
export async function releaseInventory(
    reservationId: string,
    orderId: string,
    items: OrderItem[],
    stepCtx: DurableContextLogger<DurableLogger>
): Promise<{ released: boolean; reservationId: string; timestamp: string }> {
    const timestamp = new Date().toISOString();

    await docClient.send(new TransactWriteCommand({
        TransactItems: items.map((item) => ({
            Update: {
                TableName: tableName(),
                Key: { productId: item.productId },
                UpdateExpression: 'SET quantity = quantity + :quantity',
                ExpressionAttributeValues: { ':quantity': item.quantity },
            },
        })),
    }));

    stepCtx.info('Inventory reservation released (compensation)', {
        reservationId,
        orderId,
        items,
        timestamp,
    });

    return {
        released: true,
        reservationId,
        timestamp,
    };
}
