import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

export const handler = async (event) => {
    const { userId } = event.arguments;

    const result = await ddbClient.send(new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: marshall({ ":pk": `USER#${userId}`, ":skPrefix": "ENROLLMENT#" }),
    }));

    return result.Items.map((item) => unmarshall(item));
};
