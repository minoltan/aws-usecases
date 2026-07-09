import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";

export const handler = async (event) => {
    const { courseId, title, description } = event.arguments;
    const now = new Date().toISOString();

    const names = { "#updatedAt": "updatedAt" };
    const values = { ":updatedAt": now };
    const sets = ["#updatedAt = :updatedAt"];

    if (title !== undefined && title !== null) {
        names["#title"] = "title";
        values[":title"] = title;
        sets.push("#title = :title");
    }
    if (description !== undefined && description !== null) {
        names["#description"] = "description";
        values[":description"] = description;
        sets.push("#description = :description");
    }

    const result = await ddbClient.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ PK: `COURSE#${courseId}`, SK: "META" }),
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values),
        ReturnValues: "ALL_NEW",
    }));

    const course = unmarshall(result.Attributes);

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: "CourseCatalog.CourseUpdated",
            Detail: JSON.stringify({ courseId }),
        }],
    }));

    return course;
};
