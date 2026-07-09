export const handler = async (event) => {
  try {
    const { examId } = event.pathParameters || {};
    if (!examId) return response(400, { error: "examId is required" });

    const questions = [
      {
        questionId: "q1",
        question: "Which AWS service is used to orchestrate serverless workflows with state management?",
        options: { A: "AWS Lambda", B: "AWS Step Functions", C: "Amazon SQS", D: "Amazon EventBridge" }
      },
      {
        questionId: "q2",
        question: "What is the maximum timeout for an AWS Lambda function?",
        options: { A: "15 minutes", B: "5 minutes", C: "1 hour", D: "30 minutes" }
      },
      {
        questionId: "q3",
        question: "Which DynamoDB capacity mode charges you only for what you use without capacity planning?",
        options: { A: "Provisioned mode", B: "Reserved mode", C: "On-demand mode", D: "Burst mode" }
      },
      {
        questionId: "q4",
        question: "What does SQS visibility timeout control?",
        options: {
          A: "How long a message is retained in the queue",
          B: "How long a message is hidden from other consumers after being received",
          C: "How long it takes for a message to be delivered",
          D: "How long the queue is available"
        }
      },
      {
        questionId: "q5",
        question: "Which Step Functions pattern allows a task to pause and wait for an external callback?",
        options: { A: "waitForEvent", B: "pauseAndResume", C: "callbackPattern", D: "waitForTaskToken" }
      }
    ];

    return response(200, { examId, totalQuestions: questions.length, durationSeconds: 300, questions });
  } catch (err) {
    console.error("GetQuestions error:", err);
    return response(500, { error: err.message });
  }
};

const response = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body)
});
