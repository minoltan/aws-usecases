import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda_event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { join } from 'path';
import { EnvironmentConfig } from '../config/environment';

export interface AsyncStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  table: dynamodb.ITable;
}

export class AsyncStack extends cdk.Stack {
  public readonly submissionQueue: sqs.Queue;
  public readonly submissionDlq: sqs.Queue;
  public readonly notificationTopic: sns.Topic;
  public readonly resultProcessorFn: NodejsFunction;
  public readonly autoSubmitFn: NodejsFunction;
  public readonly stateMachine: sfn.StateMachine;
  /** Role EventBridge Scheduler assumes to invoke autoSubmitFn for a per-session timer. */
  public readonly schedulerExecutionRole: iam.Role;

  constructor(scope: Construct, id: string, props: AsyncStackProps) {
    super(scope, id, props);

    this.submissionDlq = new sqs.Queue(this, 'SubmissionDLQ', {
      queueName: `${props.envConfig.domainPrefix}-submission-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });

    this.submissionQueue = new sqs.Queue(this, 'SubmissionQueue', {
      queueName: `${props.envConfig.domainPrefix}-submission-queue`,
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      deadLetterQueue: {
        queue: this.submissionDlq,
        maxReceiveCount: 3,
      },
    });

    this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `${props.envConfig.domainPrefix}-notifications`,
      displayName: 'Exam Platform Notifications',
    });
    this.notificationTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.envConfig.alarmEmail),
    );

    this.resultProcessorFn = new NodejsFunction(this, 'ResultProcessorFunction', {
      functionName: `${props.envConfig.domainPrefix}-result-processor`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, '../../lambda/result-processor/index.js'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      reservedConcurrentExecutions: 100,
      logGroup: new logs.LogGroup(this, 'ResultProcessorLogGroup', {
        logGroupName: '/exam-platform/result-processor',
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        TABLE_NAME: props.table.tableName,
        NOTIFICATION_TOPIC_ARN: this.notificationTopic.topicArn,
      },
    });
    this.resultProcessorFn.addEventSource(
      new lambda_event_sources.SqsEventSource(this.submissionQueue, { batchSize: 10 }),
    );
    props.table.grantReadWriteData(this.resultProcessorFn);
    this.notificationTopic.grantPublish(this.resultProcessorFn);

    this.autoSubmitFn = new NodejsFunction(this, 'AutoSubmitFunction', {
      functionName: `${props.envConfig.domainPrefix}-auto-submit`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, '../../lambda/auto-submit/index.js'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      environment: {
        TABLE_NAME: props.table.tableName,
        SUBMISSION_QUEUE_URL: this.submissionQueue.queueUrl,
      },
    });
    props.table.grantReadWriteData(this.autoSubmitFn);
    this.submissionQueue.grantSendMessages(this.autoSubmitFn);

    // EventBridge Scheduler creates one schedule per exam session at session-start time
    // (done at runtime by the Exam Service via scheduler:CreateSchedule) targeting this
    // function exactly at the exam's end time. This role is what those schedules assume.
    this.schedulerExecutionRole = new iam.Role(this, 'SchedulerExecutionRole', {
      roleName: `${props.envConfig.domainPrefix}-scheduler-exec-role`,
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    this.autoSubmitFn.grantInvoke(this.schedulerExecutionRole);

    this.stateMachine = this.buildStateMachine(props);

    new cdk.CfnOutput(this, 'SubmissionQueueUrl', {
      value: this.submissionQueue.queueUrl,
      exportName: `ExamPlatform-${props.envConfig.envName}-SubmissionQueueUrl`,
    });
    new cdk.CfnOutput(this, 'SubmissionQueueArn', {
      value: this.submissionQueue.queueArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-SubmissionQueueArn`,
    });
    new cdk.CfnOutput(this, 'DlqUrl', {
      value: this.submissionDlq.queueUrl,
      exportName: `ExamPlatform-${props.envConfig.envName}-DlqUrl`,
    });
    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopic.topicArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-NotificationTopicArn`,
    });
    new cdk.CfnOutput(this, 'ResultProcessorArn', {
      value: this.resultProcessorFn.functionArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-ResultProcessorArn`,
    });
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-StateMachineArn`,
    });
    new cdk.CfnOutput(this, 'SchedulerExecutionRoleArn', {
      value: this.schedulerExecutionRole.roleArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-SchedulerExecutionRoleArn`,
    });

    cdk.Tags.of(this).add('Project', 'ExamPlatform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
  }

  /**
   * Models the exam lifecycle as an audit trail. Each state stamps the
   * session's status via a direct DynamoDB integration with Retry/Catch.
   * Real exams run for hours, so in production the IN_PROGRESS state would
   * pause on a task token until Submission Service / AutoSubmit calls back
   * instead of falling straight through — kept as a direct chain here to
   * keep the state machine's shape readable and synth-testable.
   */
  private buildStateMachine(props: AsyncStackProps): sfn.StateMachine {
    const retry: sfn.RetryProps = {
      errors: [sfn.Errors.ALL],
      maxAttempts: 3,
      backoffRate: 2,
      interval: cdk.Duration.seconds(2),
    };

    const handleError = new sfn.Fail(this, 'HandleError', {
      error: 'ExamLifecycleError',
      cause: 'A lifecycle transition failed after exhausting retries',
    });

    const statusUpdate = (id: string, status: string) =>
      new tasks.DynamoUpdateItem(this, id, {
        table: props.table,
        key: {
          PK: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.pk')),
          SK: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.sk')),
        },
        updateExpression: 'SET #status = :status',
        expressionAttributeNames: { '#status': 'status' },
        expressionAttributeValues: {
          ':status': tasks.DynamoAttributeValue.fromString(status),
        },
        resultPath: sfn.JsonPath.DISCARD,
      }).addRetry(retry).addCatch(handleError, { errors: [sfn.Errors.ALL] });

    const created = statusUpdate('CreatedState', 'CREATED');
    const started = statusUpdate('StartedState', 'STARTED');
    const inProgress = statusUpdate('InProgressState', 'IN_PROGRESS');
    const submitted = statusUpdate('SubmittedState', 'SUBMITTED');
    const grading = statusUpdate('GradingState', 'GRADING');
    const completed = statusUpdate('CompletedState', 'COMPLETED');

    const definition = created
      .next(started)
      .next(inProgress)
      .next(submitted)
      .next(grading)
      .next(completed);

    const logGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: '/exam-platform/step-functions',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    return new sfn.StateMachine(this, 'ExamLifecycleStateMachine', {
      stateMachineName: `${props.envConfig.domainPrefix}-exam-lifecycle`,
      stateMachineType: sfn.StateMachineType.STANDARD,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });
  }
}
