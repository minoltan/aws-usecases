import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class ExamPlatformStorage extends Construct {
  public readonly sessionsTable: ITable;
  public readonly answersTable: ITable;
  public readonly examQueue: IQueue;
  public readonly gradingQueue: IQueue;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.sessionsTable = this.createSessionsTable();
    this.answersTable = this.createAnswersTable();
    this.examQueue = this.createExamQueue();
    this.gradingQueue = this.createGradingQueue();
  }

  private createSessionsTable(): ITable {
    return new Table(this, 'ExamSessions', {
      tableName: 'ExamSessions',
      partitionKey: { name: 'examId', type: AttributeType.STRING },
      sortKey: { name: 'studentId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  private createAnswersTable(): ITable {
    return new Table(this, 'ExamAnswers', {
      tableName: 'ExamAnswers',
      partitionKey: { name: 'examId', type: AttributeType.STRING },
      sortKey: { name: 'questionId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  private createExamQueue(): IQueue {
    const dlq = new Queue(this, 'ExamQueueDLQ', {
      queueName: 'ExamQueueDLQ',
      retentionPeriod: Duration.days(14),
    });

    return new Queue(this, 'ExamQueue', {
      queueName: 'ExamQueue',
      visibilityTimeout: Duration.seconds(7200),
      retentionPeriod: Duration.days(1),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });
  }

  private createGradingQueue(): IQueue {
    const dlq = new Queue(this, 'GradingQueueDLQ', {
      queueName: 'GradingQueueDLQ',
      retentionPeriod: Duration.days(14),
    });

    return new Queue(this, 'GradingQueue', {
      queueName: 'GradingQueue',
      visibilityTimeout: Duration.seconds(300),
      retentionPeriod: Duration.days(1),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });
  }
}
