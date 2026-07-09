import { randomUUID } from "node:crypto";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

// The schema annotates this mutation with @aws_subscribe(mutations: ["postMessage"]),
// so AppSync fans this handler's return value out to onMessagePosted subscribers itself --
// the direct modern replacement for the book's Firebase websocket forum.
export const handler = async (event) => {
    const { threadId, body } = event.arguments;
    const authorId = event.identity?.sub ?? "unknown";
    const postId = randomUUID();
    const now = new Date().toISOString();

    const message = {
        PK: `THREAD#${threadId}`,
        SK: `POST#${now}#${postId}`,
        postId,
        threadId,
        authorId,
        body,
        createdAt: now,
    };

    await ddbClient.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(message),
    }));

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "Discussion.MessagePosted",
            Detail: JSON.stringify({ threadId, postId, authorId }),
        }],
    }));

    return message;
};
