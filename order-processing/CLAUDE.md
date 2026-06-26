# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install --save-dev          # install deps
npm run build                   # tsc compile (lib/ and test/)
npm run watch                   # tsc -w
npm test                        # local unit tests (jest.config.js) - mocks AWS SDK clients, no deployment needed
npm run test:cloud              # cloud integration test against a deployed stack (jest.cloud.config.js)
npx tsc --noEmit -p tsconfig.json   # fast type-check without touching test infra

npx cdk synth                   # synthesize CloudFormation (also bundles all 4 Lambdas via esbuild)
npx cdk deploy                  # deploy the stack
npx cdk destroy                 # tear down (RemovalPolicy.DESTROY on everything, including log groups)
```

Run a single local test file or test case:
```bash
npx jest --config jest.config.js test/order-processor.test.ts
npx jest --config jest.config.js -t "should complete order with approved payment"
```

`npm run test:cloud` requires `ORDER_PROCESSOR_FUNCTION_NAME="order-processor:\$LATEST"` and a deployed stack; it's skipped automatically if that env var isn't set.

There is no lint script configured.

## Architecture

This is a CDK app demonstrating **AWS Lambda Durable Functions** (`@aws/durable-execution-sdk-js`) for an order-processing saga. The interesting logic is the orchestration in `lib/lambda/order-processor.ts` and how it relates to the other Lambdas — reading any one file in isolation won't explain the workflow.

### The five Lambdas

- **`order-processor.ts`** (durable) — the orchestrator. `withDurableExecution(...)` wraps a single async function; each side effect is wrapped in `context.step(name, fn)`, which checkpoints the result so replays don't re-run it. Flow: validate (Bedrock) → `context.wait()` 10s cancellation window → check cancellation (DB read) → price + reserve inventory → `context.invoke()` the payment processor → finalize. `context.invoke()` is a *durable* cross-function call — the caller suspends (no compute billed) until the callee's durable execution completes.
- **`payment-processor.ts`** (durable) — currently a mock that always approves; invoked via `context.invoke()` from order-processor. This is intentionally a stand-in for a real payment gateway (tracked in the README's "Known Limitations").
- **`api-handler.ts`** (plain Lambda, API Gateway proxy) — `POST /orders`, `GET /orders/{orderId}`, `POST /orders/{orderId}/cancel`. Fronts the durable workflow: claims the orderId in DynamoDB (conditional `PutItem`, so a resubmitted orderId 409s instead of double-starting a durable execution), then invokes `order-processor` asynchronously (`InvocationType: 'Event'`, `DurableExecutionName: order-${orderId}` for idempotency).
- **`notification-emailer.ts`** (plain Lambda, SNS-triggered) — subscribed to the `OrderStatusTopic`; forwards every published `OrderResult` as an email via SES `SendEmail`. SES is in sandbox mode for this stack, so both sender and recipient must be the same verified identity (`NOTIFICATION_EMAIL` constant in the stack).
- **`docs-handler.ts`** (plain Lambda, API Gateway proxy) — `GET /docs` (Swagger UI HTML) and `GET /docs/openapi.json` (the spec, imported directly from `openapi.json` via `resolveJsonModule`). Swagger UI's static assets load from a CDN at runtime, not bundled, so this function stays tiny. The spec URL is computed client-side from `window.location.pathname` so it works under any stage prefix without hardcoding it.

### Saga compensation pattern

`order-processor.ts` builds a `compensations: CompensationEntry[]` list inside a single `try` block. Each side-effecting step (currently just inventory reservation) pushes an undo entry onto the list *after* it succeeds. On any failure in the try block (payment rejected, payment invocation error, etc.), the `catch` iterates `compensations.reverse()` and runs each undo function, collecting `CompensationAction[]` results regardless of individual failures. This is the idiomatic pattern for adding new side-effecting steps: do the work, then immediately register its compensation before moving to the next step.

### Inventory: pricing + atomic multi-item reservation

`inventory.ts` is the one place price and stock correctness live:
- **Pricing is server-side.** The client never sends `amount` — `Order.amount` starts `undefined` and is computed inside the `reserve-inventory` step by reading each line item's `price` attribute from the `inventory` table and summing `price * quantity`. The computed amount then flows into `PaymentResult` and the persisted `OrderRecord`.
- **Reservation/release use `TransactWriteCommand`**, not per-item `UpdateCommand`, so a multi-item order reserves or releases *every* line item atomically — no partial reservations across items. Each item's `Update` still carries `ConditionExpression: quantity >= :requested`, so DynamoDB itself rejects overselling without any application-level locking.
- `dynamodb:TransactWriteItems` is **not** included in CDK's `Table.grantReadWriteData()` — it needs an explicit `iam.PolicyStatement` (see the stack). If you add another transactional table operation, check whether its action needs the same explicit grant.

### DynamoDB as the source of truth alongside durable execution state

The durable execution framework retains its own history, but `order-store.ts` maintains a parallel, longer-lived `OrderRecord` in the `orders` table (durable executions expire per `retentionPeriod`). `getOrderRecord`/`updateOrderProgress` are how state crosses Lambda boundaries: `api-handler.ts`'s `/cancel` endpoint sets `cancelRequested: true` on the record, and `order-processor.ts`'s cancellation-check step (`validation.ts`) reads that same record — there is no other channel between the two Lambdas for this. `updateOrderProgress` takes a `Partial<Pick<OrderRecord, ...>>` of an explicit allow-list; extending what it can set means adding the field to that `Pick` union.

### Region and model constraints

`bin/order-processing.ts` hardcodes the stack's deploy region to `us-east-1` regardless of `AWS_REGION`/`CDK_DEFAULT_REGION` — Amazon Nova Lite needs a cross-region inference profile (`BEDROCK_INFERENCE_PROFILE_ID` in the stack) outside `us-east-1` for this account, so the IAM policy and model ID are tied together. Bedrock validation in `validation.ts` is currently short-circuited to always return `isValid: true` (no on-demand Nova Lite throughput quota yet) — the real `InvokeModel` call is left in place but commented out below the early return.

### Lambda bundling

All four functions use `NodejsFunction` with `format: ESM` and `externalModules: []` (bundle everything). The ESM bundles need the `createRequire` banner (already present in every function's `bundling.banner`) because some bundled deps still use CJS-style `require` internally — copy that banner verbatim when adding a new Lambda entry point.
