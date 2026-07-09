import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { s3Client } from "./s3Client.js";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

export const handler = async (event) => {
    const { courseId, lessonId, fileName } = event.arguments;
    const videoId = randomUUID();
    const s3Key = `uploads/${videoId}/${fileName}`;
    const now = new Date().toISOString();

    const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({ Bucket: process.env.RAW_BUCKET_NAME, Key: s3Key }),
        { expiresIn: 900 }
    );

    await ddbClient.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall({
            PK: `VIDEO#${videoId}`,
            SK: "META",
            GSI1PK: `COURSE#${courseId}`,
            GSI1SK: `VIDEO#${videoId}`,
            videoId,
            courseId,
            lessonId: lessonId ?? null,
            status: "PENDING_UPLOAD",
            rawKey: s3Key,
            cloudFrontUrl: null,
            createdAt: now,
            updatedAt: now,
        }, { removeUndefinedValues: true }),
    }));

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "Video.UploadRequested",
            Detail: JSON.stringify({ videoId, courseId }),
        }],
    }));

    return { videoId, uploadUrl, s3Key };
};
