const mockDdbSend = jest.fn();
const mockEbSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
    class FakeCommand {
        input: any;
        constructor(input: any) {
            this.input = input;
        }
    }
    return {
        DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockDdbSend })),
        PutItemCommand: FakeCommand,
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { handler } = require('../../src/handlers/enrollment/enroll/index.js');

describe('enrollment/enroll handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.TABLE_NAME = 'enrollment-test';
        process.env.EVENT_BUS_NAME = 'test-bus';
        process.env.EVENT_SOURCE = 'course-platform.enrollment';
    });

    it('writes a PENDING_PAYMENT enrollment record and publishes EnrollmentCreated', async () => {
        mockDdbSend.mockResolvedValue({});
        mockEbSend.mockResolvedValue({});

        const event = {
            arguments: { courseId: 'course-1' },
            identity: { sub: 'user-1' },
        };

        const result = await handler(event);

        expect(result.status).toBe('PENDING_PAYMENT');
        expect(result.paymentStatus).toBe('UNPAID');
        expect(result.userId).toBe('user-1');
        expect(result.courseId).toBe('course-1');

        expect(mockDdbSend).toHaveBeenCalledTimes(1);

        expect(mockEbSend).toHaveBeenCalledTimes(1);
        const putEventsInput = mockEbSend.mock.calls[0][0].input;
        const entry = putEventsInput.Entries[0];
        expect(entry.DetailType).toBe('Enrollment.EnrollmentCreated');
        expect(JSON.parse(entry.Detail)).toEqual({ userId: 'user-1', courseId: 'course-1' });
    });

    it('throws when there is no authenticated identity, without writing to DynamoDB', async () => {
        const event = { arguments: { courseId: 'course-1' }, identity: null };

        await expect(handler(event)).rejects.toThrow('Unauthenticated');
        expect(mockDdbSend).not.toHaveBeenCalled();
        expect(mockEbSend).not.toHaveBeenCalled();
    });
});
