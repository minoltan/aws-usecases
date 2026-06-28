# Manually testing the deployed stack

> The REST routes below only return real data once `services/exam-service` and
> `services/submission-service` have an image pushed to their ECR repos — see
> `docs/deploying-services.md` if `POST /exams/{examId}/start` is timing out or 5xx-ing.

## REST API — Swagger UI

After `cdk deploy ExamPlatform-<env>-Api`, the stack prints a `SwaggerUrl` output
(`https://<api-id>.execute-api.<region>.amazonaws.com/<env>/docs`). Open it in a browser —
no Cognito token required, the `/docs` routes are deliberately public. It renders the spec
served from `/docs/openapi.json` (`lambda/docs-handler/`).

Every other route under `/exams/{examId}/...` requires a Cognito access token (the
`Authorize` button in Swagger UI lets you paste one in). Get a token by signing a student in
through the User Pool client (`AuthStack`'s `UserPoolClientId` output), e.g.:

```bash
aws cognito-idp admin-create-user --user-pool-id <UserPoolId> --username student@example.com
aws cognito-idp admin-set-user-password --user-pool-id <UserPoolId> --username student@example.com --password 'Passw0rd!' --permanent
aws cognito-idp initiate-auth --client-id <UserPoolClientId> --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=student@example.com,PASSWORD='Passw0rd!'
# -> AuthenticationResult.AccessToken is what the authorizer expects
```

The `auth-validator` authorizer also requires an active `SESSION` item in DynamoDB for the
`examId` in the path (status `STARTED`/`IN_PROGRESS`) — `POST /exams/{examId}/start` creates
that via the Exam Service before any other route will authorize.

## AppSync GraphQL — no client needed, use the AWS Console

The fastest way to run queries/mutations/subscriptions against `ExamProgressApi` and watch
results live, with zero local setup:

1. AWS Console → **AppSync** → open the API named `<domainPrefix>-progress-api` (the
   `AppSyncApiId` stack output gives you the exact API to open if more than one matches).
2. Left nav → **Queries**. This is a hosted GraphiQL-style editor.
3. Auth mode: the API accepts both Cognito User Pool tokens (default) and **IAM** (additional
   mode). In the console, the Queries tab authenticates using your *signed-in AWS Console
   session's IAM identity* automatically — easiest option, no token wrangling needed.

Example query (matches `lib/appsync/schema.graphql`):

```graphql
query GetSession {
  getSession(studentId: "student-123", examId: "EXAM-101") {
    studentId
    examId
    status
    timeRemaining
    answeredCount
  }
}
```

It resolves directly against the `ExamPlatform` table — populate a `SESSION` item first (DynamoDB
Console → table → "Create item"):

```json
{
  "PK": "STUDENT#student-123",
  "SK": "SESSION#EXAM#EXAM-101",
  "Type": "SESSION",
  "status": "IN_PROGRESS",
  "timeRemaining": 5400,
  "answeredCount": 3
}
```

### Watching the real-time subscription fire

Open a **second** Queries tab and start a subscription — the console keeps the WebSocket open
and streams results into the same pane as they arrive:

```graphql
subscription OnSessionUpdated {
  onSessionUpdated(studentId: "student-123", examId: "EXAM-101") {
    studentId
    examId
    status
    timeRemaining
    answeredCount
  }
}
```

`onSessionUpdated` only fires when `Mutation.publishSessionUpdate` actually executes — there
are two ways to trigger that while the subscription tab is open:

- **End-to-end (realistic):** edit the same `SESSION` item in the DynamoDB Console (e.g. bump
  `timeRemaining`). The table's stream invokes `session-stream-publisher`, which signs a
  `publishSessionUpdate` call back to AppSync — watch `/exam-platform/...` CloudWatch Logs for
  that function if nothing shows up within a few seconds.
- **Direct (skips the stream, fastest to sanity-check the schema/subscription wiring):** run the
  mutation by hand in a first Queries tab:

  ```graphql
  mutation Publish {
    publishSessionUpdate(input: {
      studentId: "student-123"
      examId: "EXAM-101"
      status: "IN_PROGRESS"
      timeRemaining: 5300
      answeredCount: 4
    }) {
      studentId
      examId
      status
      timeRemaining
      answeredCount
    }
  }
  ```

  The subscription tab should show the same payload appear immediately.

### From the command line instead

`appsync-realtime-client`/raw WebSocket wrangling is unnecessary for queries/mutations — IAM-sign
a plain HTTPS POST with `awscurl` (`pip install awscurl`):

```bash
awscurl --service appsync -X POST <AppSyncEndpoint> \
  -H "Content-Type: application/json" \
  -d '{"query":"query { getSession(studentId: \"student-123\", examId: \"EXAM-101\") { status timeRemaining } }"}'
```
