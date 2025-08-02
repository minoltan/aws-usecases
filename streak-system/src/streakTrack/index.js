import { UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ddbClient } from "./client";

const TABLE_NAME = process.env.STREAK_TABLE_NAME;
const MAX_FREEZE_DAYS = 2;

export const handler = async (event) => {
  try {
    const { userId } = JSON.parse(event.body);
    if (!userId) {
      return { statusCode: 400, body: JSON.stringify({ error: "userId is required" }) };
    }

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // ✅ Get current streak and freeze days
    const { currentStreak, lastLogin, freezeDaysRemaining } = await getUserData(userId);

    // ✅ If already logged in today
    if (lastLogin === today) {
      return success({ message: "Already logged in today", currentStreak, freezeDaysRemaining });
    }

    let newStreak = 1;
    let newFreeze = freezeDaysRemaining;

    // ✅ Case 1: Consecutive login (yesterday)
    if (lastLogin === yesterdayStr) {
      newStreak = currentStreak + 1;
    } 
    // ✅ Case 2: Missed days but has freeze days → use one
    else if (freezeDaysRemaining > 0) {
      newStreak = currentStreak; // keep streak intact
      newFreeze = freezeDaysRemaining - 1; // use one freeze day
    }

    // ✅ Update DB
    await updateUserData(userId, today, newStreak, newFreeze);

    return success({
      message: freezeDaysRemaining > 0 && lastLogin !== yesterdayStr ? 
        "Missed day covered by a freeze day" : "Streak updated",
      currentStreak: newStreak,
      freezeDaysRemaining: newFreeze
    });

  } catch (err) {
    console.error("Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// 🔹 Get user streak & freeze data
async function getUserData(userId) {
  const { Item } = await ddbClient.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ userId, streakType: "daily" }), // using same PK as freeze
  }));

  if (!Item) return { currentStreak: 0, lastLogin: null, freezeDaysRemaining: 0 };

  const data = unmarshall(Item);
  return {
    currentStreak: data.currentStreak || 0,
    lastLogin: data.lastLogin || null,
    freezeDaysRemaining: data.freezeDaysRemaining || 0
  };
}

// 🔹 Update streak and freeze count
async function updateUserData(userId, today, newStreak, newFreeze) {
  await ddbClient.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ userId, streakType: "daily" }),
    UpdateExpression: "SET currentStreak = :cs, lastLogin = :dt, freezeDaysRemaining = :fd",
    ExpressionAttributeValues: marshall({
      ":cs": newStreak,
      ":dt": today,
      ":fd": newFreeze
    })
  }));
}

// 🔹 Helper success response
function success(body) {
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body)
  };
}
