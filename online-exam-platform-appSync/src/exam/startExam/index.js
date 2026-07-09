import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

const dynamo = new DynamoDBClient({});
const sfn = new SFNClient({});

const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || "ExamSessions";

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { examId, studentId } = body;

    if (!examId || !studentId) {
      return response(400, { error: "examId and studentId are required" });
    }

    const existing = await dynamo.send(new GetItemCommand({
      TableName: SESSIONS_TABLE,
      Key: { examId: { S: examId }, studentId: { S: studentId } }
    }));

    if (existing.Item) {
      return response(409, { error: "Exam session already exists for this student" });
    }

    const execution = await sfn.send(new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      name: `exam-${examId}-student-${studentId}-${Date.now()}`,
      input: JSON.stringify({
        examId, studentId,
        examDurationSeconds: 300,
        waitSeconds: 1
      })
    }));

    await dynamo.send(new PutItemCommand({
      TableName: SESSIONS_TABLE,
      Item: {
        examId: { S: examId },
        studentId: { S: studentId },
        status: { S: "CREATED" },
        executionArn: { S: execution.executionArn },
        createdAt: { S: new Date().toISOString() }
      }
    }));

    return response(201, {
      message: "Exam session started successfully",
      examId, studentId,
      executionArn: execution.executionArn,
      status: "CREATED"
    });
  } catch (err) {
    console.error("StartExam error:", err);
    return response(500, { error: err.message });
  }
};

const response = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body)
});
