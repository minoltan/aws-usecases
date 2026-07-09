import { DynamoDBClient, GetItemCommand, UpdateItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

const dynamo = new DynamoDBClient({});
const sfn = new SFNClient({});
const sqs = new SQSClient({});

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ExamSessions";
const ANSWERS_TABLE = process.env.ANSWERS_TABLE || "ExamAnswers";
const EXAM_QUEUE_URL = process.env.EXAM_QUEUE_URL;

const CORRECT_ANSWERS = { "q1": "B", "q2": "A", "q3": "C", "q4": "B", "q5": "D" };

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { examId, studentId, answers } = body;

    if (!examId || !studentId || !answers || !Array.isArray(answers)) {
      return response(400, { error: "examId, studentId and answers[] are required" });
    }

    const sessionResult = await dynamo.send(new GetItemCommand({
      TableName: SESSIONS_TABLE,
      Key: { examId: { S: examId }, studentId: { S: studentId } }
    }));

    if (!sessionResult.Item) {
      return response(404, { error: "Exam session not found" });
    }

    const status = sessionResult.Item.status?.S;
    if (["SUBMITTED", "COMPLETED", "GRADING"].includes(status)) {
      return response(409, { error: `Exam already ${status}` });
    }

    for (const ans of answers) {
      const isCorrect = CORRECT_ANSWERS[ans.questionId] === ans.answer;
      await dynamo.send(new PutItemCommand({
        TableName: ANSWERS_TABLE,
        Item: {
          examId: { S: examId },
          questionId: { S: ans.questionId },
          studentId: { S: studentId },
          answer: { S: ans.answer },
          isCorrect: { BOOL: isCorrect },
          savedAt: { S: new Date().toISOString() }
        }
      }));
    }

    const sqsResult = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: EXAM_QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 2
    }));

    const message = sqsResult.Messages?.find(m => {
      const b = JSON.parse(m.Body);
      return b.examId === examId && b.studentId === studentId;
    });

    if (!message) {
      return response(404, { error: "Task token not found. Exam may have already expired." });
    }

    const { taskToken } = JSON.parse(message.Body);

    await sfn.send(new SendTaskSuccessCommand({
      taskToken,
      output: JSON.stringify({ examId, studentId, submittedAt: new Date().toISOString() })
    }));

    await sqs.send(new DeleteMessageCommand({
      QueueUrl: EXAM_QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle
    }));

    await dynamo.send(new UpdateItemCommand({
      TableName: SESSIONS_TABLE,
      Key: { examId: { S: examId }, studentId: { S: studentId } },
      UpdateExpression: "SET #s = :submitted, submittedAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":submitted": { S: "SUBMITTED" },
        ":now": { S: new Date().toISOString() }
      }
    }));

    return response(200, {
      message: "Exam submitted successfully",
      examId, studentId,
      answersSubmitted: answers.length,
      status: "SUBMITTED"
    });
  } catch (err) {
    console.error("SubmitExam error:", err);
    return response(500, { error: err.message });
  }
};

const response = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body)
});
