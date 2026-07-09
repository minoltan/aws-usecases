import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

export const handler = async (event) => {
    const { courseId } = event.arguments;
    const userId = event.identity?.sub;
    if (!userId) {
        throw new Error("Unauthenticated: no user identity on request");
    }
    const now = new Date().toISOString();

    const enrollment = {
        PK: `USER#${userId}`,
        SK: `ENROLLMENT#${courseId}`,
        GSI1PK: `COURSE#${courseId}`,
        GSI1SK: `USER#${userId}`,
        userId,
        courseId,
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        enrolledAt: now,
    };

    await ddbClient.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(enrollment),
        ConditionExpression: "attribute_not_exists(PK)",
    }));

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "Enrollment.EnrollmentCreated",
            Detail: JSON.stringify({ userId, courseId }),
        }],
    }));

    return enrollment;
};
