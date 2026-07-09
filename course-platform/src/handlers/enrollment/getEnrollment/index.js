import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

export const handler = async (event) => {
    const { userId, courseId } = event.arguments;

    const result = await ddbClient.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ PK: `USER#${userId}`, SK: `ENROLLMENT#${courseId}` }),
    }));

    return result.Item ? unmarshall(result.Item) : null;
};
