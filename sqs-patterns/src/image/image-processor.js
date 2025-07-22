const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { ChangeMessageVisibilityCommand, DeleteMessageCommand, SQSClient } = require('@aws-sdk/client-sqs');
const { UpdateItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const sharp = require('sharp');

const s3 = new S3Client();
const sqs = new SQSClient();
const dynamodb = new DynamoDBClient();

async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

exports.handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));

    for (const record of event.Records) {
        try {
            const { imageId, productId, s3Key, originalSize } = JSON.parse(record.body);
            
            // Extend timeout if processing large image
            if (originalSize > 50000000) { // 50MB
                await sqs.send(new ChangeMessageVisibilityCommand({
                    QueueUrl: process.env.IMAGE_QUEUE_URL,
                    ReceiptHandle: record.receiptHandle,
                    VisibilityTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '130')
                }));
            }

            // Get original image from S3
            const originalImage = await s3.send(new GetObjectCommand({
                Bucket: process.env.UPLOAD_BUCKET,
                Key: s3Key
            }));

            const imageBuffer = await streamToBuffer(originalImage.Body);

            // Process image (resize, optimize)
            const processedImage = await sharp(imageBuffer)
                .resize(800, 800, { fit: 'inside' })
                .webp({ quality: 80 })
                .toBuffer();

            // Upload processed image
            await s3.send(new PutObjectCommand({
                Bucket: process.env.PROCESSED_BUCKET,
                Key: `processed/${imageId}.webp`,
                Body: processedImage,
                ContentType: 'image/webp'
            }));

            // Update product in DynamoDB
            await dynamodb.send(new UpdateItemCommand({
                TableName: process.env.PRODUCT_TABLE_NAME,
                Key: { productId: { S: productId } },
                UpdateExpression: 'SET hasProcessedImage = :true, imageUrl = :url',
                ExpressionAttributeValues: {
                    ':true': { BOOL: true },
                    ':url': { S: `https://${process.env.PROCESSED_BUCKET}.s3.amazonaws.com/processed/${imageId}.webp` }
                }
            }));

            // Delete message after successful processing
            await sqs.send(new DeleteMessageCommand({
                QueueUrl: process.env.IMAGE_QUEUE_URL,
                ReceiptHandle: record.receiptHandle
            }));

        } catch (e) {
            console.error('Error processing image:', e);
            // Message will become visible again after visibility timeout
        }
    }
};