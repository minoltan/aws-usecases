import { randomUUID } from "node:crypto";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

export const handler = async (event) => {
    const { input } = event.arguments;
    const courseId = randomUUID();
    const now = new Date().toISOString();

    const course = {
        PK: `COURSE#${courseId}`,
        SK: "META",
        GSI1PK: `CATEGORY#${input.category ?? "uncategorized"}`,
        GSI1SK: `COURSE#${courseId}`,
        courseId,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        instructorId: input.instructorId,
        enrollmentCount: 0,
        createdAt: now,
        updatedAt: now,
    };

    await ddbClient.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(course, { removeUndefinedValues: true }),
    }));

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "CourseCatalog.CourseCreated",
            Detail: JSON.stringify({ courseId, category: course.category, instructorId: input.instructorId }),
        }],
    }));

    return course;
};
