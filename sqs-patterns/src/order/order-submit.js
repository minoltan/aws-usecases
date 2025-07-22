const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { v4: uuidv4 } = require('uuid');

const sqs = new SQSClient();

exports.handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));

    try {
        const orderRequest = JSON.parse(event.body);
        
        // Validate order data
        if (!orderRequest.customerId || !orderRequest.items || !Array.isArray(orderRequest.items)) {
            throw new Error('Invalid order data - customerId and items array are required');
        }

        // Add metadata
        const orderId = `ORD-${uuidv4()}`;
        const orderData = {
            ...orderRequest,
            orderId,
            createdAt: new Date().toISOString(),
            status: 'PENDING'
        };

        // Send to SQS
        await sqs.send(new SendMessageCommand({
            QueueUrl: process.env.ORDER_QUEUE_URL,
            MessageBody: JSON.stringify(orderData)
        }));

        return {
            statusCode: 202,
            body: JSON.stringify({
                message: 'Order received and queued for processing',
                orderId: orderId
            })
        };

    } catch (e) {
        console.error(e);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Failed to process order",
                errorMsg: e.message,
                errorStack: e.stack,
            })
        };
    }
};