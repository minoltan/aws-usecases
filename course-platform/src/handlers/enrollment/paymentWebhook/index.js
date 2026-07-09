import { createHmac, timingSafeEqual } from "node:crypto";
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ddbClient } from "./ddbClient.js";
import { ebClient } from "./eventBridgeClient.js";
import { secretsClient } from "./secretsClient.js";

let cachedSecret;

// Demo-scope stand-in for the payment provider's webhook signing secret (e.g. Stripe's
// whsec_*), fetched once per Lambda execution environment and reused across invocations.
const getWebhookSecret = async () => {
    if (cachedSecret) return cachedSecret;
    const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: process.env.WEBHOOK_SECRET_ARN }));
    cachedSecret = result.SecretString;
    return cachedSecret;
};

export const isValidSignature = (rawBody, signatureHeader, secret) => {
    if (!signatureHeader) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const provided = Buffer.from(signatureHeader);
    const expectedBuf = Buffer.from(expected);
    return provided.length === expectedBuf.length && timingSafeEqual(provided, expectedBuf);
};

// The one deliberate non-GraphQL entry point in course-platform: payment webhooks are
// fired by an external provider that cannot call AppSync, so this is a plain HttpApi route.
export const handler = async (event) => {
    const rawBody = event.body ?? "";
    const signatureHeader = event.headers?.["x-webhook-signature"] ?? event.headers?.["X-Webhook-Signature"];
    const secret = await getWebhookSecret();

    if (!isValidSignature(rawBody, signatureHeader, secret)) {
        return { statusCode: 400, body: JSON.stringify({ message: "Invalid signature" }) };
    }

    const payload = JSON.parse(rawBody);
    const { userId, courseId, status } = payload;
    const paymentStatus = status === "succeeded" ? "PAID" : "FAILED";

    await ddbClient.send(new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: marshall({ PK: `USER#${userId}`, SK: `ENROLLMENT#${courseId}` }),
        UpdateExpression: "SET paymentStatus = :paymentStatus, #status = :enrollmentStatus",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
            ":paymentStatus": paymentStatus,
            ":enrollmentStatus": paymentStatus === "PAID" ? "ACTIVE" : "PAYMENT_FAILED",
        }),
    }));

    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_SOURCE,
            DetailType: paymentStatus === "PAID" ? "Enrollment.PaymentSucceeded" : "Enrollment.PaymentFailed",
            Detail: JSON.stringify({ userId, courseId }),
        }],
    }));

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
