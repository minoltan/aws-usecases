import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";
import kuuid from "kuuid";

export const handler = async (event) => {
    try {
        const payload = JSON.parse(event.body);

        await createPrize(payload);

        return {
            statusCode: 201,
            headers: { 'Access-Control-Allow-Origin': '*' },
        };

    } catch (error) {
        console.error({ level: 'ERROR', message: 'Handler error', error });
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: error.message }),
        };
    }
};


async function createPrize(payload) {
    const prizeID = kuuid.id({
        random: 4,
        millisecond: true
    });

    const prizeItem = {
        PK: 'PRIZE',
        SK: prizeID,
        active: true,
        available_stock: payload.stock,
        initial_stock: payload.stock,
        last_updated: Date.now(),
        name: payload.name,
        version: 0,
        weight: payload.weight
    };

    const input = {
        TableName: process.env.DYNAMO_TABLE_NAME,
        Item: marshall(prizeItem)
    };

    const command = new PutItemCommand(input);
    await ddbClient.send(command);
}
