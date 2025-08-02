import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./client.js";

const TABLE_NAME = process.env.STREAK_TABLE_NAME;

export const handler = async (event) => {
  try {
    const { userId, won } = JSON.parse(event.body);

    if (!userId || won === undefined) {
      return formatResponse(400, { error: "userId and won (true/false) are required" });
    }

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Get current game streak data
    const { currentWinStreak, maxWinStreak, lastWinDate } = await getGameStreak(userId);

    let newWinStreak = currentWinStreak;
    let newMaxWinStreak = maxWinStreak;

    if (won) {
      // If last game was yesterday, continue streak, else reset to 1
      newWinStreak = lastWinDate === yesterdayStr ? currentWinStreak + 1 : 1;

      // Update max streak
      if (newWinStreak > maxWinStreak) {
        newMaxWinStreak = newWinStreak;
      }

      // Update DynamoDB
      await updateGameStreak(userId, today, newWinStreak, newMaxWinStreak);
    } else {
      // Player lost → reset current streak
      newWinStreak = 0;
      await updateGameStreak(userId, today, newWinStreak, maxWinStreak);
    }

    return formatResponse(200, {
      message: won ? "Game won streak updated" : "Game lost, streak reset",
      currentWinStreak: newWinStreak,
      maxWinStreak: newMaxWinStreak
    });

  } catch (err) {
    console.error("Error updating game streak:", err);
    return formatResponse(500, { error: err.message });
  }
};

// 🔹 Get current streak from DynamoDB
async function getGameStreak(userId) {
  const { Item } = await ddbClient.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ userId, streakType: "game" }),
    ProjectionExpression: "currentWinStreak, maxWinStreak, lastWinDate"
  }));

  if (!Item) {
    return { currentWinStreak: 0, maxWinStreak: 0, lastWinDate: null };
  }

  const data = unmarshall(Item);
  return {
    currentWinStreak: data.currentWinStreak || 0,
    maxWinStreak: data.maxWinStreak || 0,
    lastWinDate: data.lastWinDate || null
  };
}

// 🔹 Update streak in DynamoDB
async function updateGameStreak(userId, today, currentWinStreak, maxWinStreak) {
  await ddbClient.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ userId, streakType: "game" }),
    UpdateExpression: "SET currentWinStreak = :cws, maxWinStreak = :mws, lastWinDate = :ld",
    ExpressionAttributeValues: marshall({
      ":cws": currentWinStreak,
      ":mws": maxWinStreak,
      ":ld": today
    }),
    ReturnValues: "UPDATED_NEW"
  }));
}

// 🔹 Helper response formatter
function formatResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body)
  };
}
