import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

export const handler = async (event) => {
    try {
        const limit = parseInt(event.queryStringParameters.limit);
        const last = event.queryStringParameters.last;

        const allPrizes = await getAllPrizes(limit, last);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(allPrizes),
        };

    } catch (error) {
        const statusCode = error.statusCode || error.$metadata?.httpStatusCode || (error.name === "ValidationException" ? 400 : 500)
        console.error({ level: 'ERROR', message: 'Handler error', error });
        return {
            statusCode: statusCode,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: error.message }),
        };
    }
};


async function getAllPrizes(limit, last) {
    const PK = "PRIZE";
    let query_command;

    if (last) {

        const exPK = PK;
        const exSK = last;

        query_command = new QueryCommand({
            TableName: process.env.DYNAMO_TABLE_NAME,
            KeyConditionExpression: "PK = :pk ",
            Limit: limit,
            ExpressionAttributeValues: marshall({ ":pk": PK }),
            ExclusiveStartKey: marshall({ PK: exPK, SK: exSK })
        });
    }
    else {

        query_command = new QueryCommand({
            TableName: process.env.DYNAMO_TABLE_NAME,
            KeyConditionExpression: "PK = :pk ",
            Limit: limit,
            ExpressionAttributeValues: marshall({ ":pk": PK })
        });
    }
    const db_QueryResponse = await ddbClient.send(query_command);
    if (db_QueryResponse.Count == 0) {
        return { prizeList: [], last: null };
    }
    const prizeList = db_QueryResponse.Items.map((i) => {
        const item = unmarshall(i);
        const newItem = { prizeID: item.SK, name: item.name, initialStock: item.initial_stock, availableStock: item.available_stock, weight: item.weight, active: item.active, lastUpdated: item.last_updated };
        return newItem;
    });

    let prizeID = null;

    if (db_QueryResponse.LastEvaluatedKey) {
        prizeID = (unmarshall(db_QueryResponse.LastEvaluatedKey)).SK;
    }

    return { prizeList, last: prizeID };
}
