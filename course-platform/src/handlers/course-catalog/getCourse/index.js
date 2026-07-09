import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

export const handler = async (event) => {
    const { courseId } = event.arguments;

    const result = await ddbClient.send(new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ PK: `COURSE#${courseId}`, SK: "META" }),
    }));

    return result.Item ? unmarshall(result.Item) : null;
};
