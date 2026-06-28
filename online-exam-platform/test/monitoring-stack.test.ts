import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Template } from 'aws-cdk-lib/assertions';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { AsyncStack } from '../lib/stacks/async-stack';
import { ExamStack } from '../lib/stacks/exam-stack';
import {
  fixtureBucket,
  fixtureSecurityGroup,
  fixtureStack,
  fixtureTable,
  fixtureVpc,
  testEnvConfig,
} from './fixtures';

describe('MonitoringStack', () => {
  const app = new cdk.App();
  const env = { account: testEnvConfig.account, region: testEnvConfig.region };

  const fixture = fixtureStack(app, 'MonitoringFixtureStack');
  const vpc = fixtureVpc(fixture);
  const table = fixtureTable(fixture);

  const asyncFixture = new AsyncStack(app, 'MonitoringFixtureAsyncStack', {
    env,
    envConfig: testEnvConfig,
    table,
  });

  const exam = new ExamStack(app, 'MonitoringFixtureExamStack', {
    env,
    envConfig: testEnvConfig,
    vpc,
    albSecurityGroup: fixtureSecurityGroup(fixture, vpc, 'FixtureAlbSg'),
    ecsSecurityGroup: fixtureSecurityGroup(fixture, vpc, 'FixtureEcsSg'),
    table,
    questionBucket: fixtureBucket(fixture),
    stateMachineArn: asyncFixture.stateMachine.stateMachineArn,
    submissionQueueUrl: asyncFixture.submissionQueue.queueUrl,
    submissionQueueArn: asyncFixture.submissionQueue.queueArn,
    schedulerExecutionRoleArn: asyncFixture.schedulerExecutionRole.roleArn,
    autoSubmitFunctionArn: asyncFixture.autoSubmitFn.functionArn,
  });

  const restApiFixture = new apigateway.RestApi(fixture, 'FixtureRestApi');
  restApiFixture.root.addMethod('GET');

  const stack = new MonitoringStack(app, 'TestMonitoringStack', {
    env,
    envConfig: testEnvConfig,
    examService: exam.examService,
    submissionService: exam.submissionService,
    submissionQueue: asyncFixture.submissionQueue,
    submissionDlq: asyncFixture.submissionDlq,
    table,
    resultProcessorFn: asyncFixture.resultProcessorFn,
    restApi: restApiFixture,
    stateMachine: asyncFixture.stateMachine,
  });
  const template = Template.fromStack(stack);

  test('creates an ops alert SNS topic with an email subscription', () => {
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: testEnvConfig.alarmEmail,
    });
  });

  test('creates the alarms called out in the spec (CPU alarmed per ECS service)', () => {
    // DLQ depth, error rate, 2x ECS CPU (exam + submission), apigw 5xx,
    // DynamoDB throttles, Step Functions failures.
    template.resourceCountIs('AWS::CloudWatch::Alarm', 7);
  });

  test('DLQ depth alarm fires above zero messages', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      Threshold: 0,
      ComparisonOperator: 'GreaterThanThreshold',
      Namespace: 'AWS/SQS',
      MetricName: 'ApproximateNumberOfMessagesVisible',
    });
  });

  test('creates the ExamPlatformDashboard', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'ExamPlatformDashboard',
    });
  });

  test('exports the ops topic ARN and dashboard name', () => {
    template.hasOutput('OpsAlertTopicArn', {});
    template.hasOutput('DashboardName', {});
  });
});
