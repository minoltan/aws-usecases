# Pearson Exam Platform — Full Project Context for Claude Code

> This file is the single source of truth for building the AWS CDK infrastructure project.
> Read this entire file before writing any code. Every decision here has been intentionally made.

---

## 1. Project Overview

**What we are building:**
A scalable online assessment delivery platform for Pearson that serves millions of students globally.
Students take timed exams, submit answers, and receive results. The system handles high concurrency
during peak exam windows, ensures exam integrity, and supports real-time progress tracking.

**Role context:** Software Engineer III (Job ID: 23507) at Pearson
**Stack:** AWS CDK v2 (TypeScript) for all infrastructure

---

## 2. Job Description — Required Skills (Build Around These)

These are the exact technologies the platform must use:

- Java 21 / Spring Boot — Exam Service, Submission Service (on ECS Fargate)
- Python 3.12 — Lambda functions (Result computation, Auth, Notifications)
- AWS Lambda — Short async tasks only (not session management)
- AWS ECS Fargate — Long-running services (Exam Service, Submission Service)
- AWS SQS / SNS — Async submission queue, notification dispatch
- AWS Step Functions — Exam lifecycle state machine (STANDARD type)
- AWS DynamoDB — Single-table design (ExamPlatform table)
- AWS AppSync — GraphQL API for real-time progress tracking
- API Gateway — REST API for student-facing endpoints
- AWS CloudWatch — Monitoring, alarms, dashboards
- AWS CloudFormation via CDK — All infrastructure as code
- AWS S3 — Question bank, file uploads
- AWS EventBridge — Exam timer events (auto-submit on timeout)
- Amazon Cognito — Student authentication
- AWS CloudFront — CDN for static assets

---

## 3. System Architecture

### 3.1 High-Level Flow

```
Student Browser
    → CloudFront CDN
        → API Gateway (REST)  →  Auth Service (Cognito + Lambda)
        → API Gateway (REST)  →  Exam Service (ECS Fargate)
        → API Gateway (REST)  →  Submission Service (ECS Fargate)
        → AppSync (GraphQL)   →  DynamoDB Streams → Real-time push

Submission Service
    → SQS Queue
        → Result Lambda
            → DynamoDB (write result)
            → SNS (notify student)

Exam Service
    → Step Functions (state machine)
        → EventBridge Scheduler (exam timer)
            → Submission Service (auto-submit on timeout)

CloudWatch → SNS (ops alerts)
```

### 3.2 Why ECS over Lambda for Core Services

- Lambda concurrency limit = 10,000 max (throttles at 1M concurrent students)
- Lambda max timeout = 15 minutes (exam sessions can be 3 hours)
- Lambda cold starts at peak burst = catastrophic for exam UX
- ECS Fargate: no concurrency ceiling, long-lived sessions, pre-warmed containers
- Lambda is used ONLY for: result computation, auth validation, timer triggers, notifications

### 3.3 Exam Lifecycle — Step Functions State Machine

```
States (in order):
CREATED → STARTED → IN_PROGRESS → SUBMITTED → GRADING → COMPLETED
                                ↑
                           EXPIRED (auto-submit via EventBridge)
```

- StateMachineType: STANDARD (need full execution history for audit)
- Every state has Retry + Catch defined
- EventBridge Scheduler triggers auto-submit exactly at exam end time
- Step Functions ARN stored on DynamoDB session item for traceability

---

## 4. DynamoDB — Single Table Design

### 4.1 Table Name: `ExamPlatform`

**Why single-table:**
- All access patterns are scoped to `studentId + examId`
- Co-locating session + answers + result under same PK = one Query call
- Multi-table would require 2+ queries per page load + cross-table transactions

### 4.2 Item Schema

```
PK                      SK                          Type        Attributes
─────────────────────────────────────────────────────────────────────────────────
STUDENT#<id>            SESSION#EXAM#<id>           SESSION     status, startTime, endTime,
                                                                stepFnArn, timeRemaining,
                                                                ttl (Unix), GSI1PK, GSI1SK

STUDENT#<id>            ANSWER#EXAM#<id>#Q<num>     ANSWER      questionId, answer,
                                                                autoSaved, version,
                                                                savedAt

STUDENT#<id>            RESULT#EXAM#<id>            RESULT      score, grade, completedAt,
                                                                breakdown, GSI2PK, GSI2SK

EXAM#<id>               METADATA                    EXAM        title, duration,
                                                                totalQuestions,
                                                                startWindow
```

### 4.3 Access Patterns

| # | Pattern | Query |
|---|---------|-------|
| AP1 | Get session for student + exam | PK=STUDENT#123, SK=SESSION#EXAM#456 |
| AP2 | Get all answers for student + exam | PK=STUDENT#123, SK begins_with(ANSWER#EXAM#456) |
| AP3 | Get all active sessions for an exam (admin) | GSI1: GSI1PK=EXAM#456, GSI1SK=IN_PROGRESS |
| AP4 | Get result for student + exam | PK=STUDENT#123, SK=RESULT#EXAM#456 |
| AP5 | Get all results for a student (history) | GSI2: GSI2PK=RESULT#STUDENT#123, sorted by completedAt |

### 4.4 GSI Definitions

```
GSI1 (Admin monitoring):
  GSI1PK = examId      (e.g., EXAM#456)
  GSI1SK = status      (e.g., IN_PROGRESS)
  → Query all active sessions for an exam

GSI2 (Student result history — sparse index):
  GSI2PK = RESULT#STUDENT#<id>   (only set on RESULT items — sparse)
  GSI2SK = completedAt           (ISO timestamp for sorting)
  ScanIndexForward = false       → Most recent result first
```

### 4.5 Key DynamoDB Rules

- TTL attribute: `ttl` (Unix epoch) — set on SESSION items, expire after 30 days post-exam
- Optimistic locking on ANSWER items: use `version` attribute + ConditionExpression
- Enable DynamoDB Streams (NEW_AND_OLD_IMAGES) — AppSync subscriptions depend on this
- Partition key prefix pattern: `ENTITY_TYPE#ID` — never use raw IDs as PK
- Add `Type` attribute to every item (SESSION, ANSWER, RESULT, EXAM)

---

## 5. CDK Project Structure

```
pearson-exam-cdk/
├── bin/
│   └── app.ts                        # CDK App — registers all stacks
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts          # VPC, subnets, security groups, NAT
│   │   ├── auth-stack.ts             # Cognito User Pool, Lambda Authorizer
│   │   ├── data-stack.ts             # DynamoDB table, GSIs, Streams, TTL
│   │   ├── async-stack.ts            # SQS, SNS, Lambda functions, Step Functions, EventBridge
│   │   ├── exam-stack.ts             # ECS Fargate cluster, Exam Service, Submission Service
│   │   ├── api-stack.ts              # API Gateway REST + AppSync GraphQL
│   │   └── monitoring-stack.ts       # CloudWatch dashboards, alarms, log groups
│   ├── constructs/
│   │   ├── exam-fargate-service.ts   # L3 construct: ECS + ALB + Auto Scaling
│   │   ├── sqs-lambda-dlq.ts         # L3 construct: SQS + Lambda + DLQ pattern
│   │   └── dynamo-gsi.ts             # L3 construct: GSI helper
│   └── config/
│       └── environment.ts            # Dev / staging / prod account config
├── lambda/
│   ├── result-processor/             # Python: compute exam score from SQS
│   │   └── handler.py
│   ├── auth-validator/               # Python: JWT + session validation
│   │   └── handler.py
│   └── auto-submit/                  # Python: EventBridge → force submit
│       └── handler.py
├── test/
│   ├── network-stack.test.ts
│   ├── auth-stack.test.ts
│   ├── data-stack.test.ts
│   ├── async-stack.test.ts
│   ├── exam-stack.test.ts
│   ├── api-stack.test.ts
│   └── monitoring-stack.test.ts
├── docs/
│   ├── architecture.md
│   └── dynamodb-access-patterns.md
├── cdk.json
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

---

## 6. Stack Deployment Order

Always deploy in this order — later stacks depend on earlier ones:

```
1. network-stack      → VPC, subnets exported
2. auth-stack         → Cognito Pool ARN, Lambda Authorizer ARN exported
3. data-stack         → DynamoDB Table ARN, Stream ARN exported
4. async-stack        → SQS URLs, SNS ARNs, Lambda ARNs, StepFn ARN exported
5. exam-stack         → ECS Cluster ARN, ALB DNS exported
6. api-stack          → API Gateway URL, AppSync endpoint exported
7. monitoring-stack   → CloudWatch dashboards, alarms (depends on all above)
```

Cross-stack values passed via `cdk.CfnOutput` + `exportName` — never hardcode ARNs.

---

## 7. Detailed Stack Specifications

### 7.1 network-stack.ts

```typescript
// Resources to create:
- VPC: 2 AZs, 2 public subnets, 2 private subnets, 1 NAT Gateway per AZ
- Security Groups:
    - alb-sg:        inbound 80/443 from 0.0.0.0/0
    - ecs-sg:        inbound 8080 from alb-sg only
    - lambda-sg:     outbound 443 to VPC endpoints
- VPC Endpoints: DynamoDB (Gateway), S3 (Gateway), SQS (Interface), SNS (Interface)

// Exports:
- vpcId
- privateSubnetIds
- publicSubnetIds
- albSecurityGroupId
- ecsSecurityGroupId
```

### 7.2 auth-stack.ts

```typescript
// Resources to create:
- Cognito User Pool:
    - selfSignUpEnabled: false (admin creates student accounts)
    - passwordPolicy: min 8 chars, requires uppercase + number
    - mfaConfiguration: OPTIONAL
    - standardAttributes: email (required)
- Cognito User Pool Client:
    - authFlows: USER_PASSWORD_AUTH, USER_SRP_AUTH
    - generateSecret: false (browser client)
- Lambda Authorizer (Python 3.12):
    - validates JWT from Cognito
    - checks active exam session in DynamoDB
    - caches policy for 300s

// Exports:
- userPoolId
- userPoolClientId
- authorizerArn
```

### 7.3 data-stack.ts

```typescript
// Resources to create:
- DynamoDB Table:
    - tableName: 'ExamPlatform'
    - partitionKey: { name: 'PK', type: AttributeType.STRING }
    - sortKey: { name: 'SK', type: AttributeType.STRING }
    - billingMode: BillingMode.PAY_PER_REQUEST
    - encryption: TableEncryption.AWS_MANAGED
    - pointInTimeRecovery: true
    - timeToLiveAttribute: 'ttl'
    - stream: StreamViewType.NEW_AND_OLD_IMAGES

- GSI1 (Admin monitoring):
    - indexName: 'GSI1'
    - partitionKey: { name: 'GSI1PK', type: AttributeType.STRING }
    - sortKey: { name: 'GSI1SK', type: AttributeType.STRING }
    - projectionType: ProjectionType.ALL

- GSI2 (Student result history — sparse):
    - indexName: 'GSI2'
    - partitionKey: { name: 'GSI2PK', type: AttributeType.STRING }
    - sortKey: { name: 'GSI2SK', type: AttributeType.STRING }
    - projectionType: ProjectionType.ALL

- S3 Bucket (question bank + file uploads):
    - versioned: true
    - encryption: BucketEncryption.S3_MANAGED
    - blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    - lifecycleRules: transition to INTELLIGENT_TIERING after 30 days

// Exports:
- tableArn
- tableName
- tableStreamArn
- questionBucketArn
- questionBucketName
```

### 7.4 async-stack.ts

```typescript
// Resources to create:

- SQS: SubmissionQueue
    - visibilityTimeout: Duration.seconds(300)
    - retentionPeriod: Duration.days(14)
    - encryption: QueueEncryption.KMS_MANAGED

- SQS: SubmissionDLQ
    - retentionPeriod: Duration.days(14)
    - maxReceiveCount: 3 (on SubmissionQueue redrive policy)

- SNS: NotificationTopic
    - email subscription for ops alerts

- Lambda: ResultProcessor (Python 3.12)
    - handler: result-processor/handler.handler
    - timeout: Duration.minutes(5)
    - memorySize: 512
    - reservedConcurrentExecutions: 100
    - eventSource: SqsEventSource(SubmissionQueue, { batchSize: 10 })
    - environment: { TABLE_NAME, NOTIFICATION_TOPIC_ARN }

- Lambda: AutoSubmit (Python 3.12)
    - handler: auto-submit/handler.handler
    - timeout: Duration.minutes(1)
    - triggered by EventBridge Scheduler per exam session

- Step Functions State Machine:
    - type: StateMachineType.STANDARD
    - states: Created → Started → InProgress → Submitted → Grading → Completed
    - each state has Retry: [{ errorEquals: ['States.ALL'], maxAttempts: 3 }]
    - each state has Catch: [{ errorEquals: ['States.ALL'], next: 'HandleError' }]

- EventBridge Rule:
    - schedule triggers AutoSubmit Lambda at exam end time

// Exports:
- submissionQueueUrl
- submissionQueueArn
- dlqUrl
- notificationTopicArn
- resultProcessorArn
- stateMachineArn
```

### 7.5 exam-stack.ts

```typescript
// Resources to create:

- ECS Cluster:
    - clusterName: 'ExamPlatformCluster'
    - containerInsights: true

- Exam Service (ApplicationLoadBalancedFargateService):
    - image: from ECR (Java 21 / Spring Boot)
    - cpu: 512, memoryLimitMiB: 1024
    - desiredCount: 2
    - healthCheckPath: '/actuator/health'
    - environment: { TABLE_NAME, STATE_MACHINE_ARN, QUESTION_BUCKET }
    - Auto Scaling:
        - minCapacity: 2, maxCapacity: 50
        - targetCpuUtilization: 70
        - scaleOnRequestCount: 1000 req/target

- Submission Service (ApplicationLoadBalancedFargateService):
    - image: from ECR (Java 21 / Spring Boot)
    - cpu: 256, memoryLimitMiB: 512
    - desiredCount: 2
    - healthCheckPath: '/actuator/health'
    - environment: { TABLE_NAME, SUBMISSION_QUEUE_URL }
    - Auto Scaling:
        - minCapacity: 2, maxCapacity: 30

- Scheduled Scaling (pre-warm before peak exam windows):
    - scale up to minCapacity: 20 at 08:45 UTC
    - scale down to minCapacity: 2 at 18:00 UTC

// Exports:
- examServiceAlbDns
- submissionServiceAlbDns
- ecsClusterArn
```

### 7.6 api-stack.ts

```typescript
// Resources to create:

- API Gateway (RestApi):
    - /exams/{examId}/start     POST → Exam Service
    - /exams/{examId}/answers   POST → Exam Service (auto-save)
    - /exams/{examId}/submit    POST → Submission Service
    - /exams/{examId}/session   GET  → Exam Service
    - All routes: Cognito Authorizer attached
    - throttling: rateLimit 10000, burstLimit 5000

- AppSync (GraphQL API):
    - authorizationConfig: AMAZON_COGNITO_USER_POOLS
    - Schema:
        type ExamSession { studentId, examId, timeRemaining, answeredCount, status }
        type Query { getSession(studentId: String!, examId: String!): ExamSession }
        type Subscription { onSessionUpdated(studentId: String!, examId: String!): ExamSession }
    - DataSource: DynamoDB table (via DynamoDB Streams resolver)
    - Resolvers: Query.getSession → DynamoDB GetItem
    - Subscription powered by DynamoDB Streams → AppSync real-time push

- CloudFront Distribution:
    - origins: API Gateway + S3 (question assets)
    - cachePolicy: CACHING_DISABLED for API routes
    - WAF WebACL attached

// Exports:
- apiGatewayUrl
- appSyncEndpoint
- cloudFrontUrl
```

### 7.7 monitoring-stack.ts

```typescript
// Resources to create:

- CloudWatch Dashboard: 'ExamPlatformDashboard'
    - Widgets: ECS CPU/Memory, SQS queue depth, DynamoDB consumed capacity,
               Lambda errors, API Gateway 4xx/5xx, Step Functions failures

- CloudWatch Alarms:
    - SQS DLQ depth > 0 → SNS alert (ops)
    - Lambda ResultProcessor error rate > 1% → SNS alert
    - ECS CPU > 85% for 5 minutes → SNS alert
    - API Gateway 5xx > 10 in 1 minute → SNS alert
    - DynamoDB throttled requests > 0 → SNS alert
    - Step Functions failed executions > 0 → SNS alert

- Log Groups (with retention):
    - /exam-platform/exam-service        → 30 days
    - /exam-platform/submission-service  → 30 days
    - /exam-platform/result-processor    → 14 days
    - /exam-platform/auth-validator      → 14 days
    - /exam-platform/step-functions      → 30 days
```

---

## 8. IAM — Least Privilege Rules

Each service gets its own role. Never share roles between services.

```
Exam Service ECS Role:
  - dynamodb:GetItem, PutItem, UpdateItem on ExamPlatform table
  - states:StartExecution on ExamStateMachine
  - s3:GetObject on QuestionBucket
  - logs:CreateLogStream, PutLogEvents

Submission Service ECS Role:
  - sqs:SendMessage on SubmissionQueue
  - dynamodb:UpdateItem on ExamPlatform table (status update only)
  - logs:CreateLogStream, PutLogEvents

ResultProcessor Lambda Role:
  - sqs:ReceiveMessage, DeleteMessage on SubmissionQueue
  - dynamodb:UpdateItem on ExamPlatform table
  - sns:Publish on NotificationTopic
  - logs:CreateLogStream, PutLogEvents

AutoSubmit Lambda Role:
  - sqs:SendMessage on SubmissionQueue
  - dynamodb:GetItem on ExamPlatform table (verify session active)
  - logs:CreateLogStream, PutLogEvents
```

---

## 9. Environment Configuration

```typescript
// lib/config/environment.ts
export const environments = {
  dev: {
    account: 'YOUR_DEV_ACCOUNT_ID',
    region: 'ap-southeast-1',
    domainPrefix: 'exam-dev',
  },
  staging: {
    account: 'YOUR_STAGING_ACCOUNT_ID',
    region: 'ap-southeast-1',
    domainPrefix: 'exam-staging',
  },
  prod: {
    account: 'YOUR_PROD_ACCOUNT_ID',
    region: 'ap-southeast-1',
    domainPrefix: 'exam',
  },
};
```

---

## 10. package.json Dependencies

```json
{
  "dependencies": {
    "aws-cdk-lib": "^2.140.0",
    "constructs": "^10.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "aws-cdk": "^2.140.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.4.0",
    "@types/jest": "^29.5.0"
  }
}
```

---

## 11. cdk.json

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "watch": {
    "include": ["**"],
    "exclude": ["README.md", "cdk*.json", "**/*.d.ts", "**/*.js", "test"]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
    "@aws-cdk/aws-ec2:restrictDefaultSecurityGroup": true
  }
}
```

---

## 12. Build Instructions for Claude Code

### Step 1 — Scaffold the project

```bash
mkdir pearson-exam-cdk && cd pearson-exam-cdk
npx cdk init app --language typescript
npm install
```

### Step 2 — Build in this exact order

1. `lib/config/environment.ts` — config first, everything imports from here
2. `lib/stacks/network-stack.ts`
3. `lib/stacks/auth-stack.ts`
4. `lib/stacks/data-stack.ts`
5. `lib/stacks/async-stack.ts`
6. `lib/stacks/exam-stack.ts`
7. `lib/stacks/api-stack.ts`
8. `lib/stacks/monitoring-stack.ts`
9. `bin/app.ts` — register all stacks with correct dependencies
10. `test/*.test.ts` — one test file per stack

### Step 3 — Validate

```bash
npm run build       # TypeScript compile — must pass
npx cdk synth       # CloudFormation synthesis — must pass with no errors
npm test            # All tests must pass
npx cdk diff        # Review what will be created before first deploy
```

### Step 4 — Deploy (dev first)

```bash
npx cdk bootstrap aws://DEV_ACCOUNT/ap-southeast-1 --profile pearson-dev
npx cdk deploy network-stack --profile pearson-dev
npx cdk deploy auth-stack --profile pearson-dev
# ... follow deployment order in Section 6
```

---

## 13. Critical Rules — Read Before Writing Any Code

1. **Always run `cdk diff` before `cdk deploy`** — check for `[replace]` operations
2. **Never rename a Construct ID** after first deploy — causes resource replacement
3. **Never rename a Stack** — causes full teardown and recreation
4. **Single-table DynamoDB** — do not create additional tables
5. **ECS for session services, Lambda for async tasks** — do not swap these
6. **All secrets in AWS Secrets Manager** — never in environment variables or cdk.json
7. **Least-privilege IAM** — each service gets its own role, use `grant*` CDK methods
8. **DynamoDB Streams must stay enabled** — AppSync subscriptions break without it
9. **StateMachineType.STANDARD** — not EXPRESS (we need execution history)
10. **Test before deploy** — `npm test` must pass, `cdk synth` must pass

---

## 14. Known Trade-offs (mention in interview / code comments)

| Decision | Trade-off |
|----------|-----------|
| ECS over Lambda for session services | Higher base cost but no concurrency ceiling |
| Single-table DynamoDB | Steeper learning curve but one Query per access pattern |
| STANDARD Step Functions | More expensive than EXPRESS but gives full audit history |
| PAY_PER_REQUEST DynamoDB billing | Cost spikes at peak vs predictable PROVISIONED |
| AppSync + DynamoDB Streams | Slight latency (~100ms) vs pure WebSocket server |
| NAT Gateway per AZ | Higher cost but no single-AZ failure for egress traffic |

---

## 15. CI/CD Pipeline — AWS CodePipeline

### 15.1 Pipeline Strategy (Industry Standard)

```
PR opened/updated
    → CodeBuild: lint + test + cdk synth (gate — no deploy)

Merge to `main`
    → CodePipeline: auto deploy to DEV

Git tag `release/v*` (e.g. release/v1.2.0)
    → CodePipeline: auto deploy to STAGING
        → Manual Approval (SNS email to team lead)
            → CodePipeline: auto deploy to PROD
```

**Branch strategy:**
```
feature/*   →  PR  →  main        (dev deploy)
main        →  tag  →  release/v* (staging → prod deploy)
```

### 15.2 Add Pipeline Stack to Project Structure

```
lib/stacks/
└── pipeline-stack.ts    ← NEW: CodePipeline definition (self-mutating)

lib/stages/
├── dev-stage.ts         ← NEW: wraps all stacks for dev environment
├── staging-stage.ts     ← NEW: wraps all stacks for staging environment
└── prod-stage.ts        ← NEW: wraps all stacks for prod environment
```

### 15.3 pipeline-stack.ts — Full Specification

```typescript
import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { pipelines } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// Use CDK Pipelines (higher-level construct over CodePipeline)
// CDK Pipelines is self-mutating — pipeline updates itself before deploying app

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Source: CodeStar connection to GitHub repo
    // (create connection manually in AWS Console first — one-time setup)
    const source = pipelines.CodePipelineSource.connection(
      'your-org/pearson-exam-cdk',  // ← replace with your GitHub org/repo
      'main',
      {
        connectionArn: 'arn:aws:codestar-connections:ap-southeast-1:ACCOUNT:connection/CONN_ID',
      }
    );

    // Shared approval SNS topic for prod manual gate
    const approvalTopic = new sns.Topic(this, 'ProdApprovalTopic', {
      topicName: 'exam-platform-prod-approval',
    });
    approvalTopic.addSubscription(
      new sns_subscriptions.EmailSubscription('team-lead@pearson.com') // ← replace
    );

    // CDK Pipeline definition
    const pipeline = new pipelines.CodePipeline(this, 'ExamPlatformPipeline', {
      pipelineName: 'ExamPlatformPipeline',
      selfMutation: true,          // pipeline updates itself first on every run
      crossAccountKeys: true,      // KMS keys for cross-account artifact encryption
      dockerEnabledForSynth: false,

      synth: new pipelines.ShellStep('Synth', {
        input: source,
        commands: [
          'npm ci',
          'npm run lint',
          'npm test',
          'npx cdk synth',
        ],
      }),
    });

    // ── STAGE 1: DEV (auto on merge to main) ──────────────────────────────
    pipeline.addStage(new DevStage(this, 'Dev', {
      env: { account: 'DEV_ACCOUNT_ID', region: 'ap-southeast-1' },
    }), {
      pre: [
        new pipelines.ShellStep('UnitTest', {
          commands: ['npm ci', 'npm test'],
        }),
      ],
      post: [
        new pipelines.ShellStep('IntegrationTest', {
          commands: [
            // smoke test: hit health endpoint after deploy
            'curl -f $EXAM_SERVICE_URL/actuator/health || exit 1',
          ],
          envFromCfnOutputs: {
            EXAM_SERVICE_URL: /* CfnOutput from exam-stack */ {} as any,
          },
        }),
      ],
    });

    // ── STAGE 2: STAGING (auto on release/v* tag) ─────────────────────────
    pipeline.addStage(new StagingStage(this, 'Staging', {
      env: { account: 'STAGING_ACCOUNT_ID', region: 'ap-southeast-1' },
    }), {
      pre: [
        new pipelines.ShellStep('StagingValidation', {
          commands: ['npm ci', 'npm test'],
        }),
      ],
      post: [
        new pipelines.ShellStep('SmokeTestStaging', {
          commands: ['curl -f $EXAM_SERVICE_URL/actuator/health || exit 1'],
          envFromCfnOutputs: {
            EXAM_SERVICE_URL: {} as any,
          },
        }),
      ],
    });

    // ── MANUAL APPROVAL GATE ──────────────────────────────────────────────
    pipeline.addStage(new ApprovalStage(this, 'ProdApproval', {
      env: { account: 'PROD_ACCOUNT_ID', region: 'ap-southeast-1' },
    }), {
      pre: [
        new pipelines.ManualApprovalStep('ApproveProdDeploy', {
          comment: 'Review staging test results before approving production deploy.',
        }),
      ],
    });

    // ── STAGE 3: PROD (after manual approval) ─────────────────────────────
    pipeline.addStage(new ProdStage(this, 'Prod', {
      env: { account: 'PROD_ACCOUNT_ID', region: 'ap-southeast-1' },
    }), {
      post: [
        new pipelines.ShellStep('SmokeTestProd', {
          commands: ['curl -f $EXAM_SERVICE_URL/actuator/health || exit 1'],
          envFromCfnOutputs: {
            EXAM_SERVICE_URL: {} as any,
          },
        }),
      ],
    });
  }
}
```

### 15.4 Stage Wrappers — lib/stages/dev-stage.ts

```typescript
// Same pattern for staging-stage.ts and prod-stage.ts
// Only difference: env account ID and environment name passed to each stack

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkStack } from '../stacks/network-stack';
import { AuthStack } from '../stacks/auth-stack';
import { DataStack } from '../stacks/data-stack';
import { AsyncStack } from '../stacks/async-stack';
import { ExamStack } from '../stacks/exam-stack';
import { ApiStack } from '../stacks/api-stack';
import { MonitoringStack } from '../stacks/monitoring-stack';

export class DevStage extends cdk.Stage {
  // Export CfnOutputs needed by pipeline post-steps
  public readonly examServiceUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    const env = 'dev';

    const network = new NetworkStack(this, 'NetworkStack', { env: props?.env });
    const auth = new AuthStack(this, 'AuthStack', {
      env: props?.env,
      vpc: network.vpc,
    });
    const data = new DataStack(this, 'DataStack', { env: props?.env });
    const async_ = new AsyncStack(this, 'AsyncStack', {
      env: props?.env,
      table: data.table,
    });
    const exam = new ExamStack(this, 'ExamStack', {
      env: props?.env,
      vpc: network.vpc,
      table: data.table,
      stateMachineArn: async_.stateMachine.stateMachineArn,
      submissionQueueUrl: async_.submissionQueue.queueUrl,
    });
    const api = new ApiStack(this, 'ApiStack', {
      env: props?.env,
      userPool: auth.userPool,
      examServiceAlbDns: exam.examServiceAlbDns,
      submissionServiceAlbDns: exam.submissionServiceAlbDns,
      table: data.table,
    });
    new MonitoringStack(this, 'MonitoringStack', {
      env: props?.env,
      submissionQueue: async_.submissionQueue,
      dlq: async_.dlq,
    });

    // Expose for pipeline smoke tests
    this.examServiceUrl = exam.examServiceHealthUrl;
  }
}
```

### 15.5 CodeBuild PR Validation (separate from pipeline)

Create this in AWS Console or via CDK — triggers on every PR, blocks merge if it fails:

```typescript
// lib/stacks/pr-validation-stack.ts

import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as cdk from 'aws-cdk-lib';

export class PrValidationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new codebuild.Project(this, 'PrValidation', {
      projectName: 'exam-platform-pr-validation',
      source: codebuild.Source.gitHub({
        owner: 'your-org',       // ← replace
        repo: 'pearson-exam-cdk',
        webhook: true,
        webhookFilters: [
          // Trigger on PR open, update, reopen — NOT on merge
          codebuild.FilterGroup
            .inEventOf(
              codebuild.EventAction.PULL_REQUEST_CREATED,
              codebuild.EventAction.PULL_REQUEST_UPDATED,
              codebuild.EventAction.PULL_REQUEST_REOPENED,
            )
            .andBranchIs('main'),
        ],
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: '20' },
            commands: ['npm ci'],
          },
          build: {
            commands: [
              'npm run lint',
              'npm test',
              'npx cdk synth',               // must synthesize without errors
              'npx cdk-nag || true',         // security best-practice checks
            ],
          },
        },
        reports: {
          jest_reports: {
            files: ['coverage/clover.xml'],
            'file-format': 'CLOVERXML',
          },
        },
      }),
    });
  }
}
```

### 15.6 Updated bin/app.ts — Register Pipeline Stack

```typescript
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/stacks/pipeline-stack';
import { PrValidationStack } from '../lib/stacks/pr-validation-stack';

const app = new cdk.App();

// Pipeline stack lives in the TOOLS account (or dev account)
// This is the only stack you deploy manually — it self-mutates after that
new PipelineStack(app, 'ExamPlatformPipeline', {
  env: { account: 'TOOLS_ACCOUNT_ID', region: 'ap-southeast-1' },
});

// PR validation project — deployed once, runs on every PR
new PrValidationStack(app, 'PrValidationStack', {
  env: { account: 'TOOLS_ACCOUNT_ID', region: 'ap-southeast-1' },
});

app.synth();
```

### 15.7 Pipeline Flow Diagram

```
Developer
    │
    ├─ opens PR
    │       └── CodeBuild PR Validation
    │               ├── npm lint          ✅/❌ blocks merge
    │               ├── npm test          ✅/❌ blocks merge
    │               └── cdk synth         ✅/❌ blocks merge
    │
    ├─ merges to main
    │       └── CodePipeline triggered
    │               ├── Source (GitHub)
    │               ├── Synth (cdk synth)
    │               ├── Self-Mutation (pipeline updates itself)
    │               ├── DEV Stage
    │               │     ├── pre:  unit tests
    │               │     ├── deploy: all 7 stacks in order
    │               │     └── post: smoke test health endpoint
    │               └── ✅ DEV live
    │
    └─ creates tag release/v1.x.x
            └── CodePipeline triggered
                    ├── STAGING Stage
                    │     ├── pre:  unit tests
                    │     ├── deploy: all 7 stacks in order
                    │     └── post: smoke test
                    ├── Manual Approval Gate
                    │     └── SNS email → team lead reviews → approves in console
                    └── PROD Stage
                          ├── deploy: all 7 stacks in order
                          └── post: smoke test health endpoint
```

### 15.8 Required One-Time Manual Setup

Before running the pipeline for the first time:

```bash
# 1. Bootstrap ALL three accounts + tools account
npx cdk bootstrap aws://TOOLS_ACCOUNT/ap-southeast-1 --profile pearson-tools
npx cdk bootstrap aws://DEV_ACCOUNT/ap-southeast-1 \
  --trust TOOLS_ACCOUNT \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
  --profile pearson-dev
npx cdk bootstrap aws://STAGING_ACCOUNT/ap-southeast-1 \
  --trust TOOLS_ACCOUNT \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
  --profile pearson-staging
npx cdk bootstrap aws://PROD_ACCOUNT/ap-southeast-1 \
  --trust TOOLS_ACCOUNT \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
  --profile pearson-prod

# 2. Create GitHub CodeStar connection in AWS Console
#    Console → CodePipeline → Settings → Connections → Create connection → GitHub
#    Copy the ARN into pipeline-stack.ts connectionArn

# 3. Deploy the pipeline stack ONCE manually
npx cdk deploy ExamPlatformPipeline --profile pearson-tools

# After this — pipeline is self-mutating.
# Every merge to main updates the pipeline AND deploys the app.
```

### 15.9 CI/CD Security Rules

- Pipeline role uses least-privilege — only `cdk deploy` permissions, not `AdministratorAccess` in prod
- Artifacts bucket encrypted with KMS (`crossAccountKeys: true`)
- Prod deploy requires manual approval — no auto-deploy to prod ever
- All secrets injected at deploy time from AWS Secrets Manager — never stored in pipeline
- CloudTrail logs all pipeline executions for audit

### 15.10 Add to package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "cdk": "cdk",
    "synth": "cdk synth",
    "diff:dev": "cdk diff --profile pearson-dev",
    "diff:staging": "cdk diff --profile pearson-staging",
    "deploy:pipeline": "cdk deploy ExamPlatformPipeline --profile pearson-tools"
  }
}
```

### 15.11 Updated Project Structure with CI/CD

```
pearson-exam-cdk/
├── bin/
│   └── app.ts
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts
│   │   ├── auth-stack.ts
│   │   ├── data-stack.ts
│   │   ├── async-stack.ts
│   │   ├── exam-stack.ts
│   │   ├── api-stack.ts
│   │   ├── monitoring-stack.ts
│   │   ├── pipeline-stack.ts        ← NEW
│   │   └── pr-validation-stack.ts   ← NEW
│   ├── stages/
│   │   ├── dev-stage.ts             ← NEW
│   │   ├── staging-stage.ts         ← NEW
│   │   └── prod-stage.ts            ← NEW
│   ├── constructs/
│   └── config/
│       └── environment.ts
├── lambda/
├── test/
│   ├── pipeline-stack.test.ts       ← NEW
│   └── ... (existing tests)
├── docs/
├── cdk.json
├── package.json
├── tsconfig.json
└── CLAUDE.md
```
