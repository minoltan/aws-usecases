const { UpdateItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DeleteMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { marshall } = require('@aws-sdk/util-dynamodb');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new DynamoDBClient();
const sqs = new SQSClient();

exports.handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));

    for (const record of event.Records) {
        try {
            const payment = JSON.parse(record.body);
            const paymentId = uuidv4();
            
            // Simulate payment processing (10% failure rate)
            const paymentStatus = Math.random() > 0.1 ? 'COMPLETED' : 'FAILED';

            // Update payment in DynamoDB
            await dynamodb.send(new UpdateItemCommand({
                TableName: process.env.PAYMENT_TABLE_NAME,
                Key: marshall({ paymentId: paymentId }),
                UpdateExpression: 'SET #orderId = :orderId, #amount = :amount, #method = :method, #status = :status, #processedAt = :now',
                ExpressionAttributeNames: {
                    '#orderId': 'orderId',
                    '#amount': 'amount',
                    '#method': 'paymentMethod',
                    '#status': 'status',
                    '#processedAt': 'processedAt'
                },
                ExpressionAttributeValues: marshall({
                    ':orderId': payment.orderId,
                    ':amount': payment.amount,
                    ':method': payment.paymentMethod,
                    ':status': paymentStatus,
                    ':now': new Date().toISOString()
                })
            }));

            if (paymentStatus === 'FAILED') {
                throw new Error('Payment processing failed');
            }

            console.log(`Payment processed for order ${payment.orderId}`);

            // Delete message from queue
            await sqs.send(new DeleteMessageCommand({
                QueueUrl: process.env.PAYMENT_QUEUE_URL,
                ReceiptHandle: record.receiptHandle
            }));

        } catch (e) {
            console.error('Error processing payment:', e);
            // Message will be retried or go to DLQ after max retries
        }
    }
};