import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

export const handler = async (event) => {
    const { courseId } = event.arguments;

    const result = await ddbClient.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: marshall({ ":gsi1pk": `COURSE#${courseId}` }),
    }));

    return result.Items.map((item) => unmarshall(item));
};
