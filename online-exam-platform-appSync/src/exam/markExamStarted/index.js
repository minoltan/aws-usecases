import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ExamSessions";

export const handler = async (event) => {
  const { examId, studentId } = event;
  try {
    await dynamo.send(new UpdateItemCommand({
      TableName: SESSIONS_TABLE,
      Key: { examId: { S: examId }, studentId: { S: studentId } },
      UpdateExpression: "SET #s = :started, startedAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":started": { S: "STARTED" },
        ":now": { S: new Date().toISOString() }
      }
    }));
    return { ...event, status: "STARTED" };
  } catch (err) {
    console.error("MarkExamStartedLambda error:", err);
    throw err;
  }
};
