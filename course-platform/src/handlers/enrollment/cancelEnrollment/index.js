import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

export const handler = async (event) => {
    const { courseId } = event.arguments;
    const userId = event.identity?.sub;
    if (!userId) {
        throw new Error("Unauthenticated: no user identity on request");
    }

    const result = await ddbClient.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ PK: `USER#${userId}`, SK: `ENROLLMENT#${courseId}` }),
        UpdateExpression: "SET #status = :status",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({ ":status": "CANCELLED" }),
        ReturnValues: "ALL_NEW",
    }));

    const enrollment = unmarshall(result.Attributes);

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "Enrollment.EnrollmentCancelled",
            Detail: JSON.stringify({ userId, courseId }),
        }],
    }));

    return enrollment;
};
