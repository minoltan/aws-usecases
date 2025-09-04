import { GetItemCommand, QueryCommand, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./ddbClient.js";

const ERROR_MESSAGES = {
    INVALID_TOKEN: 'Invalid token or no spins remaining',
    NO_PRIZE: 'No prizes available'
};
export const handler = async (event) => {
    const token = event.queryStringParameters?.token;

    try {
        const configItem = await loadConfig();
        const prizes = await loadEligiblePrizes();
        if (prizes.length === 0) {throw new Error("No prizes available");}

        const tokenItem = await checkTokenEligibility(token);
        if (!tokenItem || tokenItem.spins_remaining <= 0) {throw new Error(ERROR_MESSAGES.INVALID_TOKEN);}

        const overallWinProb = configItem.overall_win_prob;
        const result = await generateOutcomeAndUpdate(token, tokenItem.spins_total, tokenItem.spins_remaining, tokenItem.version, prizes, overallWinProb);

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                outcome: result.outcome,
                prize: result.prizeWon,
                spins_remaining: tokenItem.spins_remaining - 1
            }),
        };

    } catch (error) {
        console.error({ level: 'ERROR', message: 'Handler error', error });
        if (error.message === ERROR_MESSAGES.INVALID_TOKEN) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: error.message }),
            };
        }
        
        if (error.message === ERROR_MESSAGES.NO_PRIZE) {
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ outcome: 'no_prize', message: error.message }),
            };
        }
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'Internal error' }),
        };
    }
};

const loadConfig = async () => {
    const data = await ddbClient.send(new GetItemCommand({
        TableName: process.env.DYNAMO_TABLE_NAME,
        Key: marshall({ PK: 'GLOBAL', SK: 'CONFIG' })
    }));
    if (!data.Item) throw new Error('Config not found');
    return unmarshall(data.Item);
};


const loadEligiblePrizes = async () => {
    const data = await ddbClient.send(new QueryCommand({
        TableName: process.env.DYNAMO_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'active = :true AND available_stock > :zero AND weight > :zero',
        ProjectionExpression: 'SK, #name, available_stock, weight, version',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: marshall({
            ':pk': 'PRIZE',
            ':true': true,
            ':zero': 0
        })
    }));
    return data.Items.map(item => unmarshall(item));
};

const checkTokenEligibility = async (token) => {
    const data = await ddbClient.send(new GetItemCommand({
        TableName: process.env.DYNAMO_TABLE_NAME,
        Key: marshall({ PK: 'PRIZE_TOKEN', SK: token })
    }));
    const item = data.Item ? unmarshall(data.Item) : null;
    if (!item || new Date(item.expire_at) <= new Date()) {
        return null;
    }
    return {
        spins_remaining: item.spins_remaining,
        spins_total: item.spins_total,
        version: item.version
    };
};


const generateOutcomeAndUpdate = async (token, spinsTotal, spinsRemaining, tokenVersion, prizes, overallWinProb) => {
    const result = calculateSpinOutcome(prizes, overallWinProb);
    const now = new Date().toISOString();
    const chanceAt = spinsTotal - spinsRemaining + 1;
    const transactItems = createTransactionItems(token, tokenVersion, spinsRemaining, result.prize, now, chanceAt);

    await ddbClient.send(new TransactWriteItemsCommand({ TransactItems: transactItems }));

    return {
        status: 'success',
        outcome: result.outcome,
        prizeWon: result.prize ? { id: result.prize.SK ,name:result.prize.name, spin_timestamp: now, chanceAt } : null
    };
};

const calculateSpinOutcome = (prizes, overallWinProb) => {
    if (Math.random() > overallWinProb) {
        return { outcome: 'no_prize', prize: null };
    }

    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight === 0) {
        return { outcome: 'no_prize', prize: null };
    }

    let cumulative = 0;
    const randWeight = Math.random() * totalWeight;
    for (const prize of prizes) {
        cumulative += prize.weight;
        if (randWeight < cumulative) {
            return { outcome: 'win', prize };
        }
    }
    return { outcome: 'no_prize', prize: null }; // Fallback
};

const createTransactionItems = (token, tokenVersion, spinsRemaining, prize, now, chanceAt) => {
    const transactItems = [{
        Update: {
            TableName: process.env.DYNAMO_TABLE_NAME,
            Key: marshall({ PK: 'PRIZE_TOKEN', SK: token }),
            UpdateExpression: 'SET spins_remaining = spins_remaining - :one, version = version + :one',
            ConditionExpression: 'spins_remaining > :zero AND version = :currentVersion',
            ExpressionAttributeValues: marshall({
                ':one': 1,
                ':zero': 0,
                ':currentVersion': tokenVersion
            })
        }
    }];

    if (prize) {
        transactItems[0].Update.UpdateExpression += ', prizes_won = list_append(prizes_won, :prizeList)';
        transactItems[0].Update.ExpressionAttributeValues = {
            ...transactItems[0].Update.ExpressionAttributeValues,
            ...marshall({
                ':prizeList': [{
                    id: prize.SK,
                    name: prize.name,
                    spin_timestamp: now,
                    chanceAt: chanceAt
                }]
            })
        };
        transactItems.push({
            Update: {
                TableName: process.env.DYNAMO_TABLE_NAME,
                Key: marshall({ PK: 'PRIZE', SK: prize.SK }),
                UpdateExpression: 'SET available_stock = available_stock - :one, version = version + :one',
                ConditionExpression: 'available_stock > :zero AND active = :true AND version = :currentVersion',
                ExpressionAttributeValues: marshall({
                    ':one': 1,
                    ':zero': 0,
                    ':true': true,
                    ':currentVersion': prize.version
                })
            }
        });
    }
    return transactItems;
};
