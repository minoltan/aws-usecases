import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ExamSessions";
const ANSWERS_TABLE = process.env.ANSWERS_TABLE || "ExamAnswers";

export const handler = async (event) => {
  const { examId, studentId } = event;
  try {
    const answersResult = await dynamo.send(new QueryCommand({
      TableName: ANSWERS_TABLE,
      KeyConditionExpression: "examId = :eid",
      ExpressionAttributeValues: { ":eid": { S: examId } }
    }));

    await dynamo.send(new UpdateItemCommand({
      TableName: SESSIONS_TABLE,
      Key: { examId: { S: examId }, studentId: { S: studentId } },
      UpdateExpression: "SET #s = :expired, expiredAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":expired": { S: "EXPIRED" },
        ":now": { S: new Date().toISOString() }
      }
    }));

    return { ...event, status: "EXPIRED", answers: answersResult.Items };
  } catch (err) {
    console.error("AutoSubmitLambda error:", err);
    throw err;
  }
};
