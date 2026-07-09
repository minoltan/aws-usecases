import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

// EventBridge target reacting to Enrollment.EnrollmentCreated off the shared bus --
// Course Catalog never calls the Enrollment microservice directly (Serverless
// Architectures on AWS, 2nd Ed., Fig 5.5: no hard dependency between microservices).
export const handler = async (event) => {
    const { courseId } = event.detail;
    if (!courseId) {
        console.warn({ level: "WARN", message: "Enrollment event missing courseId", detail: event.detail });
        return;
    }

    await ddbClient.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ PK: `COURSE#${courseId}`, SK: "META" }),
        UpdateExpression: "ADD enrollmentCount :one",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: marshall({ ":one": 1 }),
    }));
};
