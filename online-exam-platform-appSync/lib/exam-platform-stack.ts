import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ExamPlatformApiGateway } from './apigateway';
import { ExamPlatformAppSync } from './appsync';
import { ExamPlatformMicroservices } from './microservices';
import { ExamPlatformStateMachine } from './statemachine';
import { ExamPlatformStorage } from './storage';

export class ExamPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Storage: ExamSessions/ExamAnswers tables, ExamQueue/GradingQueue
    const storage = new ExamPlatformStorage(this, 'Storage');

    // AppSync GraphQL API - created early since Lambda env vars need its URL/key
    const appsync = new ExamPlatformAppSync(this, 'AppSync');

    // Lambdas - everything except StartExamLambda, which needs the state
    // machine's ARN and is added once the state machine below exists.
    const microservices = new ExamPlatformMicroservices(this, 'Microservices', {
      sessionsTable: storage.sessionsTable,
      answersTable: storage.answersTable,
      examQueue: storage.examQueue,
      gradingQueue: storage.gradingQueue,
      api: appsync.api,
    });

    // Step Functions state machine driving the exam lifecycle
    const stateMachine = new ExamPlatformStateMachine(this, 'StateMachine', {
      markExamStartedFn: microservices.markExamStartedFn,
      autoSubmitFn: microservices.autoSubmitFn,
      gradingFn: microservices.gradingFn,
      notifyFn: microservices.notifyFn,
      submitExamFn: microservices.submitExamFn,
      examQueue: storage.examQueue,
      gradingQueue: storage.gradingQueue,
    });

    const startExamFn = microservices.addStartExamLambda(stateMachine.stateMachine);

    // REST API exposing the exam endpoints
    new ExamPlatformApiGateway(this, 'ApiGateway', {
      startExamFn,
      submitExamFn: microservices.submitExamFn,
      getQuestionsFn: microservices.getQuestionsFn,
      getResultFn: microservices.getResultFn,
      docsFn: microservices.docsFn,
    });

    // ─────────────────────────────────────────
    // CLOUDFORMATION OUTPUTS
    // ─────────────────────────────────────────

    new cdk.CfnOutput(this, 'AppSyncURL', {
      value: appsync.api.graphqlUrl,
      description: 'AppSync GraphQL URL',
      exportName: 'ExamPlatformAppSyncUrl',
    });

    new cdk.CfnOutput(this, 'AppSyncApiKey', {
      value: appsync.api.apiKey || '',
      description: 'AppSync API Key',
      exportName: 'ExamPlatformAppSyncKey',
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachine.stateMachineArn,
      description: 'Step Functions State Machine ARN',
      exportName: 'ExamPlatformStateMachineArn',
    });

    new cdk.CfnOutput(this, 'ExamSessionsTableName', {
      value: storage.sessionsTable.tableName,
      description: 'ExamSessions DynamoDB Table',
    });

    new cdk.CfnOutput(this, 'ExamAnswersTableName', {
      value: storage.answersTable.tableName,
      description: 'ExamAnswers DynamoDB Table',
    });
  }
}
