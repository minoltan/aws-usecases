import { randomUUID } from "node:crypto";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

export const handler = async (event) => {
    const { input } = event.arguments;
    const lessonId = randomUUID();

    const lesson = {
        PK: `COURSE#${input.courseId}`,
        SK: `LESSON#${lessonId}`,
        lessonId,
        courseId: input.courseId,
        title: input.title,
        order: input.order ?? 0,
    };

    await ddbClient.send(new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall(lesson, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(SK)",
    }));

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "CourseCatalog.LessonAdded",
            Detail: JSON.stringify({ courseId: input.courseId, lessonId }),
        }],
    }));

    return lesson;
};
