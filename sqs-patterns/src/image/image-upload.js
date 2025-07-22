const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { SendMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { v4: uuidv4 } = require('uuid');

const s3 = new S3Client();
const sqs = new SQSClient();

exports.handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));

    try {
        const { imageData, productId } = JSON.parse(event.body);
        
        // Generate unique image ID
        const imageId = `img-${uuidv4()}`;
        const s3Key = `uploads/${imageId}`;

        // Upload to S3
        await s3.send(new PutObjectCommand({
            Bucket: process.env.UPLOAD_BUCKET,
            Key: s3Key,
            Body: Buffer.from(imageData, 'base64'),
            ContentType: 'image/jpeg'
        }));

        // Send processing request to queue
        await sqs.send(new SendMessageCommand({
            QueueUrl: process.env.IMAGE_QUEUE_URL,
            MessageBody: JSON.stringify({
                imageId,
                productId,
                s3Key,
                originalSize: imageData.length
            })
        }));

        return {
            statusCode: 202,
            body: JSON.stringify({
                message: 'Image uploaded and queued for processing',
                imageId
            })
        };

    } catch (e) {
        console.error(e);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Failed to upload image",
                errorMsg: e.message,
                errorStack: e.stack,
            })
        };
    }
};