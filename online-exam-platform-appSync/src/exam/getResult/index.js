import { DynamoDBClient, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ExamSessions";
const ANSWERS_TABLE = process.env.ANSWERS_TABLE || "ExamAnswers";

export const handler = async (event) => {
  try {
    const { examId, studentId } = event.pathParameters || {};
    if (!examId || !studentId) return response(400, { error: "examId and studentId are required" });

    const sessionResult = await dynamo.send(new GetItemCommand({
      TableName: SESSIONS_TABLE,
      Key: { examId: { S: examId }, studentId: { S: studentId } }
    }));

    if (!sessionResult.Item) return response(404, { error: "Exam session not found" });

    const session = sessionResult.Item;
    const status = session.status?.S;

    if (status !== "COMPLETED") {
      return response(200, {
        examId, studentId, status,
        message: `Exam is currently ${status}. Results available after COMPLETED.`
      });
    }

    const answersResult = await dynamo.send(new QueryCommand({
      TableName: ANSWERS_TABLE,
      KeyConditionExpression: "examId = :eid",
      ExpressionAttributeValues: { ":eid": { S: examId } }
    }));

    const answers = (answersResult.Items || []).map(item => ({
      questionId: item.questionId?.S,
      answer: item.answer?.S,
      isCorrect: item.isCorrect?.BOOL
    }));

    return response(200, {
      examId, studentId,
      status: "COMPLETED",
      score: Number(session.score?.N || 0),
      totalQuestions: answers.length,
      correctAnswers: answers.filter(a => a.isCorrect).length,
      startedAt: session.startedAt?.S,
      submittedAt: session.submittedAt?.S || session.expiredAt?.S,
      completedAt: session.completedAt?.S,
      answers
    });
  } catch (err) {
    console.error("GetResult error:", err);
    return response(500, { error: err.message });
  }
};

const response = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body)
});
