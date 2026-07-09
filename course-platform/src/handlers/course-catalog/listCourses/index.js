import { QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

export const handler = async (event) => {
    const { category } = event.arguments ?? {};

    if (category) {
        const result = await ddbClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :gsi1pk",
            ExpressionAttributeValues: marshall({ ":gsi1pk": `CATEGORY#${category}` }),
        }));
        return result.Items.map((item) => unmarshall(item));
    }

    const result = await ddbClient.send(new ScanCommand({
        TableName: process.env.TABLE_NAME,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: marshall({ ":sk": "META" }),
    }));
    return result.Items.map((item) => unmarshall(item));
};
