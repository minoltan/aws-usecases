# Pearson Exam Platform — AWS CDK Infrastructure

A serverless exam delivery platform built with AWS CDK (TypeScript).
Serves the core backend infrastructure for the Pearson Senior Software Engineer assessment system.

---

## Tech Stack

- **IaC:** AWS CDK v2 (TypeScript)
- **Runtime:** Java 21 (Spring Boot on ECS Fargate), Node.js 20.x (Lambda, ESM, AWS SDK v3)
- **Database:** DynamoDB (single-table design)
- **Messaging:** SQS, SNS, EventBridge
- **Orchestration:** AWS Step Functions
- **API:** API Gateway (REST), AWS AppSync (GraphQL)
- **Auth:** Amazon Cognito + Lambda Authorizer
- **Monitoring:** CloudWatch
- **Region:** ap-southeast-1 (primary)

---

## Commands

```bash
# Install dependencies
npm install

# Synthesize CloudFormation templates
npx cdk synth

# Diff before every deploy — ALWAYS run this first
npx cdk diff

# Deploy a specific stack
npx cdk deploy <StackName>

# Deploy all stacks
npx cdk deploy --all

# Destroy a stack (non-prod only)
npx cdk destroy <StackName>

# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Build TypeScript
npm run build

# Watch mode during development
npm run watch
```

---

## Project Structure

```
cdk-exam-platform/
├── bin/
│   └── app.ts                  # CDK App entry point — all stacks registered here
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts    # VPC, subnets, security groups
│   │   ├── auth-stack.ts       # Cognito user pool, Lambda authorizer
│   │   ├── exam-stack.ts       # ECS Fargate cluster + task definitions
│   │   ├── async-stack.ts      # SQS, SNS, Lambda, Step Functions
│   │   ├── data-stack.ts       # DynamoDB table, GSIs, streams
│   │   ├── api-stack.ts        # API Gateway REST + AppSync GraphQL
│   │   └── monitoring-stack.ts # CloudWatch dashboards, alarms
│   ├── constructs/             # Reusable L3 constructs
│   └── config/
│       └── environment.ts      # Environment-specific config (dev/staging/prod)
├── lambda/                     # Lambda function source code (Node.js 20.x, ESM, AWS SDK v3)
├── services/
│   ├── exam-service/            # Java 21 / Spring Boot 3, Maven — real app, see below
│   └── submission-service/      # Java 21 / Spring Boot 3, Maven — real app, see below
├── scripts/
│   └── build-and-push-services.sh
├── test/                       # Jest unit tests per stack
├── cdk.json
└── CLAUDE.md
```

---

## Architecture Rules

### Construct ID Safety — CRITICAL
- **Never rename a Construct ID** after first deploy without a replacement strategy
- **Never rename a Stack** — this causes full resource replacement
- Always run `cdk diff` and check for `[replace]` operations before deploying
- If renaming is unavoidable, use `addOverride` or a blue/green migration

### Stack Dependencies
- Real deploy order (CDK infers this from prop wiring in `bin/app.ts`, regardless of instantiation order): `network → data → auth → async → exam → waf/api → monitoring`. Data has to precede Auth because the authorizer Lambda checks session state in DynamoDB.
- `WafStack` is pinned to `us-east-1` (CLOUDFRONT-scoped WAFv2 requirement) and consumed by `ApiStack` via `crossRegionReferences: true` on both stacks.
- Cross-stack references pass live CDK constructs as props between stacks (e.g. `data.table` into `AuthStack`) — CDK wires the underlying Fn::ImportValue/exports automatically. Each stack also emits its own `CfnOutput`s with explicit `exportName`s for documentation/ops visibility; don't rely on those for actual cross-stack wiring.
- Watch for accidental cross-stack security-group ingress rules and Lambda-authorizer resource policies — both have caused real cyclic-dependency synth failures in this codebase (see `exam-stack.ts`'s shared `albSecurityGroup`/`loadBalancer` pattern and `api-stack.ts`'s `assumeRole` on the `TokenAuthorizer`).
- Each stack is independently deployable after initial bootstrap

### DynamoDB — Single Table
- One table: `ExamPlatform` — do NOT create additional tables without discussion
- PK/SK pattern: `ENTITY_TYPE#ID` (e.g., `STUDENT#123`, `EXAM#456`)
- All new access patterns require a GSI — add to `data-stack.ts`
- TTL attribute name: `ttl` (Unix timestamp) — always set on session items
- Enable DynamoDB Streams on the main table — AppSync subscriptions depend on it

### Lambda Functions
- Runtime: Node.js 20.x for short async tasks, Java 21 only if reusing Spring logic
- Each function is a `NodejsFunction` pointing at a plain ESM `index.js` under `lambda/<name>/` (no TS, no build step) — local esbuild bundling, not Docker. Only `@aws-sdk/*` packages are externalized by default (the Lambda runtime provides them); any other third-party dependency (e.g. `aws4` in `session-stream-publisher`) must be a real root `package.json` dependency so esbuild can actually bundle it.
- Memory: start at 512MB, tune after CloudWatch metrics
- Timeout: set explicitly — never rely on default (3s is too short for most tasks)
- Always attach a DLQ to every Lambda triggered by SQS
- Reserved concurrency required on Result Lambda to prevent runaway costs — `reservedConcurrentExecutions: 100` is set on `ResultProcessorFunction` (`async-stack.ts`)

### ECS Fargate
- Use `ApplicationLoadBalancedFargateService` construct for Exam Service and Submission Service
- Task CPU/Memory: start at `512 CPU / 1024 MB`, scale via `ScalableTaskCount`
- Pre-warm with scheduled scaling before exam windows (use `ApplicationAutoScaling`)
- Health check path: `/actuator/health`
- `ExamStack` creates the ECR repos (`new ecr.Repository`, not `fromRepositoryName`) but never
  builds/pushes into them — that stays a separate step (`scripts/build-and-push-services.sh`,
  see `docs/deploying-services.md`) precisely so `cdk synth`/tests never invoke Docker for the
  Java images. Don't switch these to `ecs.ContainerImage.fromAsset()` without re-checking that
  tradeoff — it would make every `cdk synth` (including the Jest test suite, which calls
  `Template.fromStack`) rebuild a full Maven+JRE Docker image.
- `services/exam-service` and `services/submission-service` are real Spring Boot 3 / Java 21
  Maven apps (AWS SDK v2, Spring Boot Actuator health). API Gateway maps the Lambda authorizer's
  `studentId` context value to an `X-Student-Id` header on the backend integration
  (`api-stack.ts`'s `backendIntegration`) — both controllers 401 via `MissingStudentIdException`
  if it's absent, since that's the only way either service knows who's calling.

### Step Functions
- Use `StateMachine` with `StateMachineType.STANDARD` (not Express) — we need execution history
- All states must have `Retry` and `Catch` blocks defined
- State names match the exam lifecycle: `CREATED → STARTED → IN_PROGRESS → SUBMITTED → GRADING → COMPLETED`
- EventBridge Scheduler triggers auto-submit on exam timeout
- **Known gap:** the current chain has no `Wait`/task-token pause between states, so all 6 run in
  one execution within ~1s of `StartExecution` (called immediately after the `SESSION` item is
  created) — it stamps `status: COMPLETED` on that same item almost instantly, racing the real
  transitions `services/submission-service`/`auto-submit`/`result-processor` make later, and
  causing `auth-validator` to deny the student shortly after they start. Don't wire this state
  machine into a real demo without fixing it first — see `docs/async-stack.md`'s "Exam Lifecycle
  State Machine" section for the trace and the fix (task-token on the `InProgress` state).

### API Gateway + AppSync
- REST (API Gateway): student answer saves, exam start/submit endpoints
- GraphQL (AppSync): real-time session progress via subscriptions
- AppSync data source: DynamoDB Streams → real-time push to student browser
- All endpoints require Cognito authorizer — no unauthenticated access (except `/docs`, deliberately public)
- **Known gap:** CloudFront's `additionalBehaviors` key is `'api/*'`, but every real route is
  under `/exams/*` or `/docs` — neither matches, so the REST API is not actually reachable
  through `CloudFrontUrl` today, only directly via `ApiGatewayUrl`. Don't assume CloudFront fronts
  the API without fixing the path pattern first — see `docs/api-stack.md`'s "CloudFront: the
  routing gap" section.

### Monitoring
- **Known gap:** the DynamoDB throttle alarm builds a raw `cloudwatch.Metric` with namespace
  `AWS/DynamoDB`, metric `ThrottledRequests`, dimension `TableName` only — that's the exact same
  shape `dynamodb.ITable#metricThrottledRequests()` produces, which CDK itself marks
  `@deprecated` as "an invalid metric." Avoiding the deprecated *method* didn't avoid the
  underlying *metric definition* it warns about; the alarm may simply never fire. The documented
  fix is `metricThrottledRequestsForOperations({ operations: [...] })`. See
  `docs/monitoring-stack.md`'s alarm section for the full trace.

### Security
- All resources in private subnets — no public IPs on ECS tasks or Lambda
- Least-privilege IAM: each Lambda/ECS task gets its own role with minimal permissions
- Secrets (DB creds, API keys) in AWS Secrets Manager — never in environment variables
- Enable AWS WAF on API Gateway for the student-facing endpoints

---

## CDK Coding Conventions

```typescript
// ✅ Always use typed props interfaces
interface ExamStackProps extends cdk.StackProps {
  tableName: string;
  vpcId: string;
}

// ✅ Use fromLookup for existing resources, never hardcode IDs
const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId });

// ✅ Tag every resource
cdk.Tags.of(this).add('Project', 'ExamPlatform');
cdk.Tags.of(this).add('Environment', props.env?.account ?? 'dev');

// ❌ Never hardcode account IDs or region strings
// ✅ Use cdk.Aws.ACCOUNT_ID and cdk.Aws.REGION

// ✅ Export values for cross-stack references
this.tableArn = new cdk.CfnOutput(this, 'TableArn', {
  value: table.tableArn,
  exportName: 'ExamPlatform-TableArn',
});
```

---

## Testing Rules

- Every stack has a corresponding `test/<stack-name>.test.ts`
- Use `assertions.Template.fromStack()` — not snapshot tests
- Assert specific resource counts and key properties
- Run `npm test` before every PR — CI blocks on test failure
- Do NOT run `cdk deploy` to verify — synthesize and assert instead

---

## Environment Config

```typescript
// lib/config/environment.ts
export const config = {
  dev:  { account: '111111111111', region: 'ap-southeast-1' },
  staging: { account: '222222222222', region: 'ap-southeast-1' },
  prod: { account: '333333333333', region: 'ap-southeast-1' },
};
```

- Never deploy to prod without a successful staging deploy
- Use `--profile` flag to switch AWS accounts: `npx cdk deploy --profile pearson-dev`

---

## CI/CD Pipeline

**Not yet implemented.** The 7 core stacks (network/data/auth/async/exam/api+waf/monitoring) are built and tested under `lib/stacks/`; `pipeline-stack.ts`, `pr-validation-stack.ts` and the `lib/stages/*` wrappers described below are still just this spec. Build core infra changes against the stacks that exist before adding the pipeline.

### Pipeline Architecture
- **PR opened/updated** → CodeBuild: lint + test + cdk synth (blocks merge if fails)
- **Merge to `main`** → CodePipeline auto-deploys to DEV
- **Git tag `release/v*`** → CodePipeline deploys to STAGING → manual approval → PROD

### Pipeline Commands
```bash
# Deploy the pipeline stack itself (one-time only)
npm run deploy:pipeline

# Diff per environment
npm run diff:dev
npm run diff:staging

# Trigger staging + prod release
git tag release/v1.0.0
git push origin release/v1.0.0
```

### Pipeline Stack Files
- `lib/stacks/pipeline-stack.ts`   — CDK Pipelines self-mutating pipeline
- `lib/stacks/pr-validation-stack.ts` — CodeBuild PR webhook
- `lib/stages/dev-stage.ts`        — all 7 stacks wrapped for dev
- `lib/stages/staging-stage.ts`    — all 7 stacks wrapped for staging
- `lib/stages/prod-stage.ts`       — all 7 stacks wrapped for prod

### CI/CD Rules
- Pipeline is self-mutating — NEVER manually edit pipeline stages after first deploy
- Prod deploy requires manual approval in AWS Console — no exceptions
- PR must pass lint + test + cdk synth before merge is allowed
- Bootstrap all accounts before first pipeline deploy (see CONTEXT.md Section 15.8)
- crossAccountKeys: true — KMS encrypts artifacts across accounts

---

## What NOT to Do

- Do NOT run `cdk destroy` on any stack with `prod` in its name
- Do NOT modify Construct IDs of existing deployed resources
- Do NOT add inline policies — use managed policies or `grant*` methods
- Do NOT skip `cdk diff` — always review before deploying
- Do NOT store secrets in `cdk.json` or environment variables

---

## References

- Architecture overview: `@docs/architecture.md`
- NetworkStack deep dive (why each VPC/SG/endpoint setting, not just what): `@docs/network-stack.md`
- DataStack deep dive (why each DynamoDB/S3 setting, not just what): `@docs/data-stack.md`
- AuthStack deep dive (why each Cognito/authorizer setting, not just what): `@docs/auth-stack.md`
- AsyncStack deep dive (why each SQS/SNS/Lambda/Step Functions setting — and a real race condition in the exam-lifecycle state machine): `@docs/async-stack.md`
- ExamStack deep dive (why each ECS/ALB/ECR/auto-scaling setting): `@docs/exam-stack.md`
- WafStack deep dive (why a separate us-east-1 stack, crossRegionReferences): `@docs/waf-stack.md`
- ApiStack deep dive (why each REST/AppSync/CloudFront setting — and a real CloudFront routing gap): `@docs/api-stack.md`
- MonitoringStack deep dive (why each alarm/dashboard setting — and a real invalid-metric gap): `@docs/monitoring-stack.md`
- Manual testing (Swagger UI, AppSync Console queries/subscriptions): `@docs/testing.md`
- Building/pushing the Spring Boot service images: `@docs/deploying-services.md`
- DynamoDB access patterns: `@docs/dynamodb-access-patterns.md`
- CI/CD pipeline config: `@.github/workflows/deploy.yml`
- Step Functions state machine definition: `@lib/stacks/async-stack.ts`
