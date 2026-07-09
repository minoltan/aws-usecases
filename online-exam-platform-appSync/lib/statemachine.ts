import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import {
  DefinitionBody,
  IStateMachine,
  IntegrationPattern,
  JsonPath,
  LogLevel,
  StateMachine,
  StateMachineType,
  Succeed,
  TaskInput,
  Timeout,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke, SqsSendMessage } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

interface ExamPlatformStateMachineProps {
  markExamStartedFn: NodejsFunction;
  autoSubmitFn: NodejsFunction;
  gradingFn: NodejsFunction;
  notifyFn: NodejsFunction;
  submitExamFn: NodejsFunction;
  examQueue: IQueue;
  gradingQueue: IQueue;
}

export class ExamPlatformStateMachine extends Construct {
  public readonly stateMachine: IStateMachine;

  constructor(scope: Construct, id: string, props: ExamPlatformStateMachineProps) {
    super(scope, id);

    // CREATED state - Wait
    const createdState = new Wait(this, 'CREATED', {
      comment: 'Admin created the exam. Waiting for student to start.',
      time: WaitTime.secondsPath('$.waitSeconds'),
    });

    // STARTED state - invoke MarkExamStartedLambda
    const startedState = new LambdaInvoke(this, 'STARTED', {
      lambdaFunction: props.markExamStartedFn,
      comment: 'Student has started the exam. Record start time.',
      resultPath: JsonPath.DISCARD,
    });

    // IN_PROGRESS state - SQS waitForTaskToken
    const inProgressState = new SqsSendMessage(this, 'IN_PROGRESS', {
      queue: props.examQueue,
      messageBody: TaskInput.fromObject({
        'taskToken': JsonPath.taskToken,
        'examId': JsonPath.stringAt('$.examId'),
        'studentId': JsonPath.stringAt('$.studentId'),
      }),
      integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      taskTimeout: Timeout.at('$.examDurationSeconds'),
      comment: 'Student is answering. Wait for submit or timer expiry.',
      resultPath: JsonPath.DISCARD,
    });

    // EXPIRED state - invoke AutoSubmitLambda
    const expiredState = new LambdaInvoke(this, 'EXPIRED', {
      lambdaFunction: props.autoSubmitFn,
      comment: 'Timer fired. Auto-submit answers collected so far.',
      resultPath: JsonPath.DISCARD,
    });

    // SUBMITTED state - SQS send to GradingQueue
    const submittedState = new SqsSendMessage(this, 'SUBMITTED', {
      queue: props.gradingQueue,
      messageBody: TaskInput.fromJsonPathAt('$'),
      comment: 'Send answers to SQS for grading.',
      resultPath: JsonPath.DISCARD,
    });

    // GRADING state - Lambda waitForTaskToken
    const gradingState = new LambdaInvoke(this, 'GRADING', {
      lambdaFunction: props.gradingFn,
      integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: TaskInput.fromObject({
        'taskToken': JsonPath.taskToken,
        'examId': JsonPath.stringAt('$.examId'),
        'studentId': JsonPath.stringAt('$.studentId'),
      }),
      comment: 'GradingLambda computes the score.',
    });

    // NOTIFY state - invoke NotifyLambda
    const notifyState = new LambdaInvoke(this, 'NOTIFY', {
      lambdaFunction: props.notifyFn,
      comment: 'Notify student via AppSync subscription.',
      resultPath: JsonPath.DISCARD,
    });

    // COMPLETED state
    const completedState = new Succeed(this, 'COMPLETED', {
      comment: 'Exam results computed and student notified.',
    });

    // Wire states together
    const definition = createdState
      .next(startedState)
      .next(
        inProgressState
          .addCatch(expiredState.next(submittedState), {
            errors: ['States.Timeout'],
            resultPath: '$.error',
          })
          .next(submittedState)
      )
      .next(gradingState)
      .next(notifyState)
      .next(completedState);

    const sfnLogGroup = new LogGroup(this, 'SFNLogGroup', {
      logGroupName: '/aws/states/ExamSessionStateMachine',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const stateMachineName = 'ExamSessionStateMachine';
    const stateMachine = new StateMachine(this, 'ExamSessionStateMachine', {
      stateMachineName,
      definitionBody: DefinitionBody.fromChainable(definition),
      stateMachineType: StateMachineType.STANDARD,
      logs: {
        destination: sfnLogGroup,
        level: LogLevel.ALL,
        includeExecutionData: true,
      },
      tracingEnabled: true,
    });

    // SFN-side permissions that depend on the state machine's own role
    props.examQueue.grantSendMessages(stateMachine.role);
    props.gradingQueue.grantSendMessages(stateMachine.role);

    // GradingLambda is itself invoked by the GRADING task above, so granting
    // task-response via stateMachine.grantTaskResponse() would create a CDK
    // dependency cycle (Lambda -> its role policy -> state machine -> state
    // machine's role policy -> Lambda again). Building the ARN from the fixed
    // state machine name instead of referencing the construct keeps the same
    // IAM permissions without the circular CloudFormation dependency.
    props.gradingFn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['states:SendTaskSuccess', 'states:SendTaskFailure', 'states:SendTaskHeartbeat'],
      resources: [`arn:aws:states:${Stack.of(this).region}:${Stack.of(this).account}:stateMachine:${stateMachineName}`],
    }));

    stateMachine.grantTaskResponse(props.submitExamFn);

    this.stateMachine = stateMachine;
  }
}
