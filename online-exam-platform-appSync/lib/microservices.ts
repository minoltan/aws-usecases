import { Duration } from 'aws-cdk-lib';
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { IStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { join } from 'path';

interface ExamPlatformMicroservicesProps {
  sessionsTable: ITable;
  answersTable: ITable;
  examQueue: IQueue;
  gradingQueue: IQueue;
  api: GraphqlApi;
}

export class ExamPlatformMicroservices extends Construct {
  public readonly markExamStartedFn: NodejsFunction;
  public readonly autoSubmitFn: NodejsFunction;
  public readonly gradingFn: NodejsFunction;
  public readonly notifyFn: NodejsFunction;
  public readonly getQuestionsFn: NodejsFunction;
  public readonly getResultFn: NodejsFunction;
  public readonly submitExamFn: NodejsFunction;
  public readonly docsFn: NodejsFunction;

  private readonly props: ExamPlatformMicroservicesProps;
  private readonly defaults: Partial<NodejsFunctionProps>;

  constructor(scope: Construct, id: string, props: ExamPlatformMicroservicesProps) {
    super(scope, id);
    this.props = props;

    this.defaults = {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        SESSIONS_TABLE: props.sessionsTable.tableName,
        ANSWERS_TABLE: props.answersTable.tableName,
        EXAM_QUEUE_URL: props.examQueue.queueUrl,
        GRADING_QUEUE_URL: props.gradingQueue.queueUrl,
        APPSYNC_URL: props.api.graphqlUrl,
        APPSYNC_KEY: props.api.apiKey || '',
      },
    };

    this.markExamStartedFn = this.createMarkExamStartedLambda();
    this.autoSubmitFn = this.createAutoSubmitLambda();
    this.gradingFn = this.createGradingLambda();
    this.notifyFn = this.createNotifyLambda();
    this.getQuestionsFn = this.createGetQuestionsLambda();
    this.getResultFn = this.createGetResultLambda();
    this.submitExamFn = this.createSubmitExamLambda();
    this.docsFn = this.createDocsLambda();
  }

  private createMarkExamStartedLambda(): NodejsFunction {
    const fn = new NodejsFunction(this, 'markExamStarted', {
      ...this.defaults,
      functionName: 'MarkExamStartedLambda',
      entry: join(__dirname, '../src/exam/markExamStarted/index.js'),
      description: 'Records exam start time in DynamoDB - called by SFN',
    });

    this.props.sessionsTable.grantReadWriteData(fn);
    return fn;
  }

  private createAutoSubmitLambda(): NodejsFunction {
    const fn = new NodejsFunction(this, 'autoSubmit', {
      ...this.defaults,
      functionName: 'AutoSubmitLambda',
      entry: join(__dirname, '../src/exam/autoSubmit/index.js'),
      description: 'Auto-submits answers when exam timer expires',
    });

    this.props.sessionsTable.grantReadWriteData(fn);
    this.props.answersTable.grantReadWriteData(fn);
    return fn;
  }

  private createGradingLambda(): NodejsFunction {
    const fn = new NodejsFunction(this, 'grading', {
      ...this.defaults,
      functionName: 'GradingLambda',
      entry: join(__dirname, '../src/exam/grading/index.js'),
      description: 'Grades exam answers and sends TaskSuccess to SFN',
      timeout: Duration.seconds(60),
    });

    this.props.sessionsTable.grantReadWriteData(fn);
    this.props.answersTable.grantReadWriteData(fn);
    this.props.gradingQueue.grantConsumeMessages(fn);

    // ESM: GradingQueue -> GradingLambda
    fn.addEventSource(new SqsEventSource(this.props.gradingQueue, {
      batchSize: 1,
      enabled: true,
    }));

    return fn;
  }

  private createNotifyLambda(): NodejsFunction {
    const fn = new NodejsFunction(this, 'notify', {
      ...this.defaults,
      functionName: 'NotifyLambda',
      entry: join(__dirname, '../src/exam/notify/index.js'),
      description: 'Publishes exam result to AppSync subscription',
    });

    fn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['appsync:GraphQL'],
      resources: [`${this.props.api.arn}/types/Mutation/fields/publishExamResult`],
    }));

    return fn;
  }

  private createGetQuestionsLambda(): NodejsFunction {
    return new NodejsFunction(this, 'getQuestions', {
      ...this.defaults,
      functionName: 'GetQuestionsLambda',
      entry: join(__dirname, '../src/exam/getQuestions/index.js'),
      description: 'Returns 5 exam questions',
    });
  }

  private createGetResultLambda(): NodejsFunction {
    const fn = new NodejsFunction(this, 'getResult', {
      ...this.defaults,
      functionName: 'GetResultLambda',
      entry: join(__dirname, '../src/exam/getResult/index.js'),
      description: 'Returns graded exam result',
    });

    this.props.sessionsTable.grantReadData(fn);
    this.props.answersTable.grantReadData(fn);
    return fn;
  }

  private createSubmitExamLambda(): NodejsFunction {
    const fn = new NodejsFunction(this, 'submitExam', {
      ...this.defaults,
      functionName: 'SubmitExamLambda',
      entry: join(__dirname, '../src/exam/submitExam/index.js'),
      description: 'Saves answers and sends TaskSuccess to SFN',
    });

    this.props.sessionsTable.grantReadWriteData(fn);
    this.props.answersTable.grantReadWriteData(fn);
    this.props.examQueue.grantConsumeMessages(fn);
    return fn;
  }

  private createDocsLambda(): NodejsFunction {
    return new NodejsFunction(this, 'docs', {
      ...this.defaults,
      functionName: 'SwaggerUILambda',
      entry: join(__dirname, '../src/docs/index.js'),
      description: 'Serves Swagger UI HTML',
    });
  }

  // StartExamLambda is the one Lambda whose dependency arrow points the other
  // way - it needs the state machine's ARN - so it's created separately, once
  // the state machine exists, instead of alongside the rest of the lambdas above.
  public addStartExamLambda(stateMachine: IStateMachine): NodejsFunction {
    const fn = new NodejsFunction(this, 'startExam', {
      ...this.defaults,
      functionName: 'StartExamLambda',
      entry: join(__dirname, '../src/exam/startExam/index.js'),
      description: 'API entry point - starts Step Functions execution',
      environment: {
        ...this.defaults.environment as Record<string, string>,
        STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
    });

    this.props.sessionsTable.grantReadWriteData(fn);
    stateMachine.grantStartExecution(fn);
    return fn;
  }
}
