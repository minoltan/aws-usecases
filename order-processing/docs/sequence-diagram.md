# Order Processing - Sequence Diagram

Covers all three API routes: submit order, check status, submit approval.

```mermaid
sequenceDiagram
    participant Client
    participant APIGW as API Gateway
    participant ApiHandler as order-api-handler
    participant DDB as orders (DynamoDB)
    participant OrderProc as order-processor
    participant PayProc as payment-processor
    participant Bedrock as Amazon Nova Lite
    participant SNS as order-status-topic
    participant DLQ as order-processor-dlq

    Note over Client,DLQ: Flow 1: POST /orders (submit order)
    Client->>APIGW: POST /orders
    APIGW->>ApiHandler: invoke
    ApiHandler->>DDB: PutItem createOrderRecord
    alt orderId already exists
        DDB-->>ApiHandler: ConditionalCheckFailedException
        ApiHandler->>DDB: GetItem existing record
        ApiHandler-->>APIGW: 409 Conflict
    else created
        ApiHandler->>OrderProc: InvokeCommand async
        OrderProc-->>ApiHandler: DurableExecutionArn
        ApiHandler->>DDB: UpdateItem executionArn
        ApiHandler-->>APIGW: 202 Accepted
    end
    APIGW-->>Client: 202 Accepted

    Note over OrderProc,DLQ: order-processor continues asynchronously
    OrderProc->>Bedrock: InvokeModel Nova Lite
    OrderProc->>PayProc: invoke
    PayProc->>DDB: UpdateItem AWAITING_APPROVAL callbackId
    OrderProc->>DDB: write status
    OrderProc->>SNS: publish status
    opt invocation fails after retries
        OrderProc-xDLQ: failed event payload
    end

    Note over Client,DDB: Flow 2: GET orders status by id
    Client->>APIGW: GET /orders/:orderId
    APIGW->>ApiHandler: invoke
    ApiHandler->>DDB: GetItem orderId
    alt not found
        DDB-->>ApiHandler: undefined
        ApiHandler-->>APIGW: 404 Not Found
    else found
        DDB-->>ApiHandler: order record
        ApiHandler-->>APIGW: 200 OK
    end
    APIGW-->>Client: response

    Note over Client,PayProc: Flow 3: POST approval decision
    Client->>APIGW: POST /orders/:orderId/approval
    APIGW->>ApiHandler: invoke
    ApiHandler->>DDB: GetItem orderId
    alt not awaiting approval
        ApiHandler-->>APIGW: 409 Conflict
    else
        ApiHandler->>PayProc: SendDurableExecutionCallbackSuccess
        Note over PayProc: resumes waitForCallback
        ApiHandler->>DDB: UpdateItem APPROVAL_SUBMITTED
        ApiHandler-->>APIGW: 200 OK
    end
    APIGW-->>Client: response
```
