import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

export const handler = async (event) => {
    const { threadId } = event.arguments;

    const result = await ddbClient.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: marshall({ ":pk": `THREAD#${threadId}`, ":skPrefix": "POST#" }),
    }));

    return result.Items.map((item) => unmarshall(item));
};
