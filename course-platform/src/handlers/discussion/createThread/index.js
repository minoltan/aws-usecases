import { randomUUID } from "node:crypto";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

export const handler = async (event) => {
    const { courseId, title } = event.arguments;
    const createdBy = event.identity?.sub ?? "unknown";
    const threadId = randomUUID();
    const now = new Date().toISOString();

    const thread = {
        PK: `THREAD#${threadId}`,
        SK: "META",
        GSI1PK: `COURSE#${courseId}`,
        GSI1SK: `THREAD#${now}`,
        threadId,
        courseId,
        title,
        createdBy,
        createdAt: now,
    };

    await ddbClient.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(thread),
    }));

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "Discussion.ThreadCreated",
            Detail: JSON.stringify({ threadId, courseId }),
        }],
    }));

    return thread;
};
