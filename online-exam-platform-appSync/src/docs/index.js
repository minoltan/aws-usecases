const API_BASE_URL = process.env.API_BASE_URL || "https://YOUR_API_ID.execute-api.ap-southeast-1.amazonaws.com/prod/";

const SWAGGER_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "Online Exam Platform API",
    description: "REST API for Online Exam Platform built on AWS Serverless.\n\n## Exam Flow\n1. GET /exams/{examId}/questions\n2. POST /exams/start\n3. POST /exams/submit\n4. GET /exams/{examId}/result/{studentId}\n\n**Answer key:** q1=B, q2=A, q3=C, q4=B, q5=D",
    version: "1.0.0"
  },
  servers: [{ url: API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL, description: "Production" }],
  tags: [{ name: "Exam", description: "Exam lifecycle operations" }],
  paths: {
    "/exams/{examId}/questions": {
      get: {
        tags: ["Exam"], summary: "Get exam questions", operationId: "getQuestions",
        parameters: [{ name: "examId", in: "path", required: true, schema: { type: "string", example: "exam-001" } }],
        responses: {
          "200": { description: "Questions returned", content: { "application/json": { example: { examId: "exam-001", totalQuestions: 5, durationSeconds: 300, questions: [{ questionId: "q1", question: "Which AWS service orchestrates serverless workflows?", options: { A: "AWS Lambda", B: "AWS Step Functions", C: "Amazon SQS", D: "Amazon EventBridge" } }] } } } }
        }
      }
    },
    "/exams/start": {
      post: {
        tags: ["Exam"], summary: "Start an exam session", operationId: "startExam",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["examId", "studentId"], properties: { examId: { type: "string", example: "exam-001" }, studentId: { type: "string", example: "student-42" } } } } } },
        responses: {
          "201": { description: "Exam started", content: { "application/json": { example: { message: "Exam session started successfully", examId: "exam-001", studentId: "student-42", status: "CREATED" } } } },
          "409": { description: "Session already exists" }
        }
      }
    },
    "/exams/submit": {
      post: {
        tags: ["Exam"], summary: "Submit exam answers", operationId: "submitExam",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["examId", "studentId", "answers"], properties: { examId: { type: "string" }, studentId: { type: "string" }, answers: { type: "array", items: { type: "object", properties: { questionId: { type: "string", enum: ["q1","q2","q3","q4","q5"] }, answer: { type: "string", enum: ["A","B","C","D"] } } } } } },
              example: { examId: "exam-001", studentId: "student-42", answers: [{ questionId: "q1", answer: "B" }, { questionId: "q2", answer: "A" }, { questionId: "q3", answer: "C" }, { questionId: "q4", answer: "B" }, { questionId: "q5", answer: "D" }] }
            }
          }
        },
        responses: { "200": { description: "Exam submitted", content: { "application/json": { example: { message: "Exam submitted successfully", answersSubmitted: 5, status: "SUBMITTED" } } } } }
      }
    },
    "/exams/{examId}/result/{studentId}": {
      get: {
        tags: ["Exam"], summary: "Get exam result", operationId: "getResult",
        parameters: [
          { name: "examId", in: "path", required: true, schema: { type: "string", example: "exam-001" } },
          { name: "studentId", in: "path", required: true, schema: { type: "string", example: "student-42" } }
        ],
        responses: { "200": { description: "Result returned", content: { "application/json": { example: { examId: "exam-001", studentId: "student-42", status: "COMPLETED", score: 100, totalQuestions: 5, correctAnswers: 5 } } } } }
      }
    }
  }
};

export const handler = async (event) => {
  const path = event.path || event.rawPath || "/";

  if (path.endsWith("/swagger.json")) {
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(SWAGGER_SPEC) };
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Online Exam Platform API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { background: #232F3E !important; }
    .topbar-wrapper img { display: none; }
    .topbar-wrapper::after { content: "Online Exam Platform API"; color: #FF9900; font-size: 20px; font-weight: bold; padding-left: 16px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: window.location.origin + window.location.pathname.replace('/swagger', '/swagger.json'),
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
      displayRequestDuration: true,
      tryItOutEnabled: true
    });
  </script>
</body>
</html>`;

  return { statusCode: 200, headers: { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" }, body: html };
};
