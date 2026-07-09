import { createHmac } from 'node:crypto';

const mockDdbSend = jest.fn();
const mockEbSend = jest.fn();
const mockSecretsSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
    class FakeCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    return {
        DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockDdbSend })),
        UpdateItemCommand: FakeCommand,
    };
});

jest.mock('@aws-sdk/client-eventbridge', () => {
    class FakeCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    return {
        EventBridgeClient: jest.fn().mockImplementation(() => ({ send: mockEbSend })),
        PutEventsCommand: FakeCommand,
    };
});

jest.mock('@aws-sdk/client-secrets-manager', () => {
    class FakeCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    return {
        SecretsManagerClient: jest.fn().mockImplementation(() => ({ send: mockSecretsSend })),
        GetSecretValueCommand: FakeCommand,
    };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { handler } = require('../../src/handlers/enrollment/paymentWebhook/index.js');

const WEBHOOK_SECRET = 'test-secret';

const sign = (body: string) => createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

describe('enrollment/paymentWebhook handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.TABLE_NAME = 'enrollment-test';
        process.env.EVENT_BUS_NAME = 'test-bus';
        process.env.EVENT_SOURCE = 'course-platform.enrollment';
        process.env.WEBHOOK_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test';
        mockSecretsSend.mockResolvedValue({ SecretString: WEBHOOK_SECRET });
    });

    it('returns 400 and skips the DynamoDB write when the signature is invalid', async () => {
        const body = JSON.stringify({ userId: 'user-1', courseId: 'course-1', status: 'succeeded' });
        const event = {
            body,
            headers: { 'x-webhook-signature': 'not-a-valid-signature' },
        };

        const response = await handler(event);

        expect(response.statusCode).toBe(400);
        expect(mockDdbSend).not.toHaveBeenCalled();
        expect(mockEbSend).not.toHaveBeenCalled();
    });

    it('marks the enrollment PAID and publishes PaymentSucceeded for a valid signature', async () => {
        mockDdbSend.mockResolvedValue({});
        mockEbSend.mockResolvedValue({});
        const body = JSON.stringify({ userId: 'user-1', courseId: 'course-1', status: 'succeeded' });
        const event = {
            body,
            headers: { 'x-webhook-signature': sign(body) },
        };

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        expect(mockDdbSend).toHaveBeenCalledTimes(1);
        const updateInput = mockDdbSend.mock.calls[0][0].input;
        expect(updateInput.ExpressionAttributeValues[':paymentStatus'].S).toBe('PAID');

        expect(mockEbSend).toHaveBeenCalledTimes(1);
        const entry = mockEbSend.mock.calls[0][0].input.Entries[0];
        expect(entry.DetailType).toBe('Enrollment.PaymentSucceeded');
    });
});
