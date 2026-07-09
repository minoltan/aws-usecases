const APPSYNC_URL = process.env.APPSYNC_URL;
const APPSYNC_KEY = process.env.APPSYNC_KEY;

export const handler = async (event) => {
  console.log("NotifyLambda received:", JSON.stringify(event));
  const { examId, studentId, score, totalQuestions, correctAnswers, completedAt } = event;

  if (!examId || !studentId) throw new Error("examId and studentId are required");

  const mutation = `
    mutation PublishExamResult(
      $examId: String! $studentId: String! $score: Int! $status: String!
      $totalQuestions: Int $correctAnswers: Int $completedAt: String
    ) {
      publishExamResult(
        examId: $examId studentId: $studentId score: $score status: $status
        totalQuestions: $totalQuestions correctAnswers: $correctAnswers completedAt: $completedAt
      ) { examId studentId score status totalQuestions correctAnswers completedAt }
    }
  `;

  const res = await fetch(APPSYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": APPSYNC_KEY },
    body: JSON.stringify({
      query: mutation,
      variables: {
        examId, studentId,
        score: score || 0,
        status: "COMPLETED",
        totalQuestions: totalQuestions || 5,
        correctAnswers: correctAnswers || 0,
        completedAt: completedAt || new Date().toISOString()
      }
    })
  });

  const data = await res.json();
  if (data.errors) {
    console.error("AppSync error:", JSON.stringify(data.errors));
    throw new Error("AppSync publish failed");
  }

  console.log("AppSync notified:", JSON.stringify(data));
  return { examId, studentId, score, status: "COMPLETED", notifiedAt: new Date().toISOString() };
};
