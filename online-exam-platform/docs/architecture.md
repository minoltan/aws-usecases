# Online Exam Platform — Architecture

Editable diagrams, roughly ordered from simplest to most detailed:
- [`architecture-birdseye.drawio`](./architecture-birdseye.drawio) — bird's-eye view, plain boxes, no AWS icons (start here)
- [`architecture-flow.drawio`](./architecture-flow.drawio) — simplified flow with AWS service icons
- [`architecture-detailed.drawio`](./architecture-detailed.drawio) — full resource-level detail (every Lambda, the DLQ, S3, EventBridge, etc.)
- [`architecture-alerting.drawio`](./architecture-alerting.drawio) — monitoring → alarms → ops SNS topic

Open any of these at [app.diagrams.net](https://app.diagrams.net) or the VS Code Draw.io extension.
The Mermaid versions below render directly in GitHub/most markdown viewers without any extra tooling.

## Bird's-eye view (mirrors architecture-birdseye.drawio)

The fastest way to explain the system in one glance — every box is a service, no IAM/route-level detail.

```mermaid
flowchart TD
    Student["🎓 Student Browser/App"]
    CDN[CloudFront CDN]
    APIGW[API Gateway REST]
    AppSync[AWS AppSync GraphQL]
    AuthSvc["Auth Service<br/>Cognito + Lambda"]
    ExamSvc["Exam Service<br/>ECS Fargate"]
    SubmitSvc["Submission Service<br/>ECS Fargate"]
    ResultSvc["Result Service<br/>Lambda"]
    SQS["SQS Queue<br/>Submission Queue"]
    SNS["SNS Topic<br/>Notifications"]
    StepFn["Step Functions<br/>Exam Lifecycle"]
    DynamoDB["DynamoDB<br/>Exam Sessions + Answers"]
    S3["S3<br/>Question Bank + File Uploads"]
    CloudWatch["CloudWatch<br/>Monitoring + Alerts"]
    EventBridge["EventBridge<br/>Exam Timer Events"]

    Student --> CDN
    CDN --> APIGW
    CDN --> AppSync
    APIGW --> AuthSvc
    APIGW --> ExamSvc
    APIGW --> SubmitSvc
    AppSync --> DynamoDB
    AuthSvc --> DynamoDB
    ExamSvc --> StepFn
    ExamSvc --> DynamoDB
    ExamSvc --> S3
    SubmitSvc --> SQS
    SQS --> ResultSvc
    ResultSvc --> DynamoDB
    ResultSvc --> SNS
    StepFn --> EventBridge
    EventBridge --> SubmitSvc
    CloudWatch --> SNS
```

## Simplified flow (mirrors architecture-flow.drawio)

Closely-related resources are merged into one box (Cognito + the Lambda authorizer into "Auth";
Step Functions + EventBridge Scheduler + the auto-submit Lambda into "Exam Timer"; the DLQ is a label
on SubmissionQueue, not a separate box) so the request/data flow reads in one pass.

```mermaid
flowchart TB
    client[Student Browser]
    cloudfront["CloudFront CDN (WAF protected)"]
    apigw[Exam REST API — API Gateway]
    appsync[Progress API — AppSync GraphQL]
    auth["Auth (Cognito + Lambda Authorizer)"]

    subgraph vpc[VPC — private subnets]
        examsvc[Exam Service — ECS Fargate]
        subsvc[Submission Service — ECS Fargate]
    end

    ddb[(ExamPlatform Table — DynamoDB + Streams)]
    examtimer["Exam Timer (Step Functions + EventBridge + auto-submit)"]
    sqs[("SubmissionQueue (SQS, + DLQ)")]
    resultproc[result-processor — Lambda]
    sns([NotificationTopic — SNS])

    client -->|HTTPS| cloudfront
    cloudfront -->|/exams/* behavior| apigw
    client -->|GraphQL + subscriptions, wss| appsync

    apigw -.->|authorize| auth
    apigw -->|start / answers / session| examsvc
    apigw -->|submit| subsvc

    appsync <-->|Query.getSession / real-time push via Streams| ddb

    examsvc -->|session read / write| ddb
    examsvc -->|start timer| examtimer
    examtimer -.->|auto-submit on timeout| subsvc

    subsvc -->|enqueue submission| sqs
    sqs -->|grade, batch 10| resultproc
    resultproc -->|write result| ddb
    resultproc -->|notify student| sns
```

## Full detail (mirrors architecture-detailed.drawio)

```mermaid
flowchart TB
    client[Student Browser]
    cloudfront[CloudFront CDN]
    waf[Web ACL — WAF]
    cognito[Student User Pool — Cognito]
    authorizer[auth-validator — Lambda Authorizer]
    apigw[Exam REST API — API Gateway]
    appsync[Progress API — AppSync GraphQL]
    s3[Question Bucket — S3]

    subgraph vpc[VPC — private subnets]
        examsvc[Exam Service — ECS Fargate]
        subsvc[Submission Service — ECS Fargate]
    end

    streampub[session-stream-publisher — Lambda]
    ddb[(ExamPlatform Table — DynamoDB + Streams)]
    sfn[Exam Lifecycle — Step Functions]
    eventbridge[Per-Session Timer — EventBridge Scheduler]
    autosubmit[auto-submit — Lambda]
    sqs[(SubmissionQueue — SQS)]
    dlq[(SubmissionDLQ — SQS)]
    resultproc[result-processor — Lambda]
    sns([NotificationTopic — SNS])

    client -->|HTTPS| cloudfront
    cloudfront -.->|protected by| waf
    cloudfront -->|/exams/* behavior| apigw
    cloudfront -->|default behavior, question assets| s3
    client -->|GraphQL + subscriptions, wss| appsync

    apigw -.->|TOKEN authorizer| authorizer
    authorizer -->|cognito-idp:GetUser| cognito
    authorizer -->|check active session| ddb
    apigw -->|start / answers / session| examsvc
    apigw -->|submit| subsvc

    appsync -.->|User Pool auth| cognito
    appsync -->|Query.getSession| ddb

    examsvc -->|read / write session| ddb
    examsvc -->|read question bank| s3
    examsvc -->|states:StartExecution| sfn
    examsvc -->|scheduler:CreateSchedule| eventbridge
    eventbridge -->|fires at exam end time| autosubmit
    autosubmit -->|mark EXPIRED| ddb
    autosubmit -->|enqueue forced submit| sqs

    subsvc -->|enqueue submission| sqs
    subsvc -->|update status| ddb

    sqs -->|batch size 10| resultproc
    sqs -.->|after 3 failed receives| dlq
    resultproc -->|write RESULT item| ddb
    resultproc -->|notify student| sns

    ddb -->|Streams, SESSION items| streampub
    streampub -->|signed Mutation.publishSessionUpdate| appsync
    appsync -.->|real-time push, onSessionUpdated| client
```

## Alerting flow (mirrors architecture-alerting.drawio)

```mermaid
flowchart LR
    ecs[Exam / Submission Service — ECS Fargate]
    dlq[(SubmissionDLQ — SQS)]
    resultproc[result-processor — Lambda]
    apigw[Exam REST API — API Gateway]
    ddb[(ExamPlatform Table — DynamoDB)]
    sfn[Exam Lifecycle — Step Functions]
    alarms{{ExamPlatformDashboard — 6 CloudWatch Alarms}}
    sns([ops-alerts — SNS, email subscription])

    ecs -.->|CPU > 85% for 5 min| alarms
    dlq -.->|DLQ depth > 0| alarms
    resultproc -.->|error rate > 1%| alarms
    apigw -.->|5xx > 10 / min| alarms
    ddb -.->|ThrottledRequests > 0| alarms
    sfn -.->|failed executions > 0| alarms
    alarms -->|ALARM action| sns
```
