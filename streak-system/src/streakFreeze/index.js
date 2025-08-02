import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./client.js";

const STREAK_TABLE_NAME = process.env.STREAK_TABLE_NAME;

export const handler = async (event) => {
    try {
        const { userId } = await validateAndParseInput(event.body);

        const { freezeDaysRemaining, itemExists } = await getCurrentFreezeDays(userId);

        if (freezeDaysRemaining >= 2) {
            return formatErrorResponse(400, "Maximum freeze days (2) already reached");
        }

        const updatedFreeze = await updateFreezeDays(userId, freezeDaysRemaining, itemExists);

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
                status: "success",
                freezeDaysRemaining: updatedFreeze
            })
        };

    } catch (error) {
        console.error("handler: ", error);
        return formatErrorResponse(400, error.message);
    }
};

async function validateAndParseInput(body) {
    const payload = JSON.parse(body);
    const { userId } = payload;

    if (!userId) {
        throw new Error("Missing required field: userId");
    }

    return { userId };
}

async function getCurrentFreezeDays(userId) {
    const { Item } = await ddbClient.send(new GetItemCommand({
        TableName: STREAK_TABLE_NAME,
        Key: marshall({ userId, streakType: "daily" }),
        ProjectionExpression: "freezeDaysRemaining"
    }));

    return {
        freezeDaysRemaining: Item ? unmarshall(Item).freezeDaysRemaining || 0 : 0,
        itemExists: !!Item
    };
}

async function updateFreezeDays(userId, currentFreezeDays, itemExists) {
    const updateParams = {
        TableName: STREAK_TABLE_NAME,
        Key: marshall({ userId, streakType: "daily" }),
        UpdateExpression: "SET freezeDaysRemaining = :newVal",
        ExpressionAttributeValues: marshall({ ":newVal": currentFreezeDays + 1 }),
        ReturnValues: "ALL_NEW"
    };

    if (!itemExists) {
        // For new records, set additional default values
        updateParams.UpdateExpression = "SET freezeDaysRemaining = :newVal, currentStreak = :zero, longestStreak = :zero, lastActivity = :empty";
        updateParams.ExpressionAttributeValues = marshall({
            ":newVal": 1,
            ":zero": 0,
            ":empty": ""
        });
    }

    const { Attributes } = await ddbClient.send(new UpdateItemCommand(updateParams));
    return unmarshall(Attributes).freezeDaysRemaining;
}

function formatErrorResponse(statusCode, message) {
    return {
        statusCode,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: message
    };
}