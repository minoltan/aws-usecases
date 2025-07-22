const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient();

exports.handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));

    try {
        const paymentRequest = JSON.parse(event.body);
        
        // Validate payment data
        if (!paymentRequest.orderId || !paymentRequest.amount || !paymentRequest.paymentMethod) {
            throw new Error('Invalid payment data - orderId, amount and paymentMethod are required');
        }

        // Add deduplication ID
        const params = {
            QueueUrl: process.env.PAYMENT_QUEUE_URL,
            MessageBody: JSON.stringify(paymentRequest),
            MessageGroupId: paymentRequest.orderId, // Maintain order per orderId
            MessageDeduplicationId: `${paymentRequest.orderId}-${Date.now()}`
        };

        // Send to FIFO queue
        await sqs.send(new SendMessageCommand(params));

        return {
            statusCode: 202,
            body: JSON.stringify({
                message: 'Payment received and queued for processing',
                orderId: paymentRequest.orderId
            })
        };

    } catch (e) {
        console.error(e);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Failed to process payment",
                errorMsg: e.message,
                errorStack: e.stack,
            })
        };
    }
};