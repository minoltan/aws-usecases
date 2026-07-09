# Online Exam Platform — AWS CDK

Serverless exam platform built with AWS Step Functions, Lambda, DynamoDB, SQS, API Gateway, and AppSync.

## Architecture

```
API Gateway → Lambda → Step Functions
                          ├── CREATED (Wait)
                          ├── STARTED (MarkExamStartedLambda)
                          ├── IN_PROGRESS (SQS waitForTaskToken)
                          ├── EXPIRED (AutoSubmitLambda)
                          ├── SUBMITTED (GradingQueue SQS)
                          ├── GRADING (GradingLambda waitForTaskToken)
                          ├── NOTIFY (NotifyLambda → AppSync)
                          └── COMPLETED
```

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node.js 18+
- AWS CDK CLI (`npm install -g aws-cdk`)

## Setup

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only per account/region)
cdk bootstrap

# Preview changes
cdk diff

# Deploy
cdk deploy
```

## After Deployment

CDK outputs these values:
- `ApiGatewayURL` — Base URL for REST API
- `SwaggerUIURL` — Open in browser for interactive API docs
- `AppSyncURL` — GraphQL endpoint
- `AppSyncApiKey` — API key for AppSync

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /exams/{examId}/questions | Get 5 questions |
| POST | /exams/start | Start exam session |
| POST | /exams/submit | Submit answers |
| GET | /exams/{examId}/result/{studentId} | Get result |
| GET | /swagger | Swagger UI |

## Answer Key (for testing)

| Question | Answer |
|----------|--------|
| q1 | B |
| q2 | A |
| q3 | C |
| q4 | B |
| q5 | D |

## Test Flow

```bash
# 1. Get questions
curl https://YOUR_API/prod/exams/exam-001/questions

# 2. Start exam
curl -X POST https://YOUR_API/prod/exams/start \
  -H "Content-Type: application/json" \
  -d '{"examId":"exam-001","studentId":"student-42"}'

# 3. Wait 3 seconds, then submit
curl -X POST https://YOUR_API/prod/exams/submit \
  -H "Content-Type: application/json" \
  -d '{"examId":"exam-001","studentId":"student-42","answers":[{"questionId":"q1","answer":"B"},{"questionId":"q2","answer":"A"},{"questionId":"q3","answer":"C"},{"questionId":"q4","answer":"B"},{"questionId":"q5","answer":"D"}]}'

# 4. Get result
curl https://YOUR_API/prod/exams/exam-001/result/student-42
```

## AppSync Real-time Subscription

Open AppSync Console → Queries and run:

```graphql
subscription {
  onExamCompleted(studentId: "student-42") {
    examId
    studentId
    score
    status
    completedAt
  }
}
```

Then trigger the exam flow — result appears instantly when grading completes.

## Destroy

```bash
cdk destroy
```
