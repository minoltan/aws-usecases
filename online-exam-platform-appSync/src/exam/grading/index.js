import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from "@aws-sdk/client-sfn";

const dynamo = new DynamoDBClient({});
const sfn = new SFNClient({});
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ExamSessions";
const ANSWERS_TABLE = process.env.ANSWERS_TABLE || "ExamAnswers";
const CORRECT_ANSWERS = { "q1": "B", "q2": "A", "q3": "C", "q4": "B", "q5": "D" };

export const handler = async (event) => {
  const payload = event.Records ? JSON.parse(event.Records[0].body) : event;
  const { taskToken, examId, studentId } = payload;

  try {
    const answersResult = await dynamo.send(new QueryCommand({
      TableName: ANSWERS_TABLE,
      KeyConditionExpression: "examId = :eid",
      ExpressionAttributeValues: { ":eid": { S: examId } }
    }));

    const items = answersResult.Items || [];
    const totalQuestions = Object.keys(CORRECT_ANSWERS).length;
    const correctCount = items.filter(i => CORRECT_ANSWERS[i.questionId?.S] === i.answer?.S).length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const completedAt = new Date().toISOString();

    await dynamo.send(new UpdateItemCommand({
      TableName: SESSIONS_TABLE,
      Key: { examId: { S: examId }, studentId: { S: studentId } },
      UpdateExpression: "SET #s = :done, score = :score, completedAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":done": { S: "COMPLETED" },
        ":score": { N: score.toString() },
        ":now": { S: completedAt }
      }
    }));

    if (taskToken) {
      await sfn.send(new SendTaskSuccessCommand({
        taskToken,
        output: JSON.stringify({ examId, studentId, score, totalQuestions, correctAnswers: correctCount, completedAt, status: "COMPLETED" })
      }));
    }

    return { examId, studentId, score, status: "COMPLETED" };
  } catch (err) {
    console.error("GradingLambda error:", err);
    if (taskToken) {
      await sfn.send(new SendTaskFailureCommand({ taskToken, error: "GradingFailed", cause: err.message }));
    }
    throw err;
  }
};
