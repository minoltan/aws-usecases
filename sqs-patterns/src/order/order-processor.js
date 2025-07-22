const { PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DeleteMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { marshall } = require('@aws-sdk/util-dynamodb');

const dynamodb = new DynamoDBClient();
const sqs = new SQSClient();

exports.handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));

    for (const record of event.Records) {
        try {
            const order = JSON.parse(record.body);
            
            // Prepare DynamoDB item
            const dbItem = {
                TableName: process.env.ORDER_TABLE_NAME,
                Item: marshall({
                    orderId: order.orderId,
                    createdAt: order.createdAt,
                    customerId: order.customerId,
                    items: order.items,
                    status: 'PROCESSED',
                    updatedAt: new Date().toISOString()
                })
            };

            // Write to DynamoDB
            await dynamodb.send(new PutItemCommand(dbItem));
            console.log('Order processed:', order.orderId);

            // Delete message from queue
            await sqs.send(new DeleteMessageCommand({
                QueueUrl: process.env.ORDER_QUEUE_URL,
                ReceiptHandle: record.receiptHandle
            }));

        } catch (e) {
            console.error('Error processing order:', e);
            // Message will become visible again after visibility timeout
        }
    }
};