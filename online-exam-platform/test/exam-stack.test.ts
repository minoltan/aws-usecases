import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ExamStack } from '../lib/stacks/exam-stack';
import {
  fixtureBucket,
  fixtureSecurityGroup,
  fixtureStack,
  fixtureTable,
  fixtureVpc,
  testEnvConfig,
} from './fixtures';

describe('ExamStack', () => {
  const app = new cdk.App();
  const fixture = fixtureStack(app, 'ExamFixtureStack');
  const vpc = fixtureVpc(fixture);
  const albSecurityGroup = fixtureSecurityGroup(fixture, vpc, 'FixtureAlbSg');
  const ecsSecurityGroup = fixtureSecurityGroup(fixture, vpc, 'FixtureEcsSg');
  const table = fixtureTable(fixture);
  const questionBucket = fixtureBucket(fixture);

  const stack = new ExamStack(app, 'TestExamStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
    envConfig: testEnvConfig,
    vpc,
    albSecurityGroup,
    ecsSecurityGroup,
    table,
    questionBucket,
    stateMachineArn: 'arn:aws:states:ap-southeast-1:111111111111:stateMachine:fixture',
    submissionQueueUrl: 'https://sqs.ap-southeast-1.amazonaws.com/111111111111/fixture-queue',
    submissionQueueArn: 'arn:aws:sqs:ap-southeast-1:111111111111:fixture-queue',
    schedulerExecutionRoleArn: 'arn:aws:iam::111111111111:role/fixture-scheduler-role',
    autoSubmitFunctionArn: 'arn:aws:lambda:ap-southeast-1:111111111111:function:fixture-auto-submit',
  });
  const template = Template.fromStack(stack);

  test('creates an ECS cluster with container insights enabled', () => {
    template.resourceCountIs('AWS::ECS::Cluster', 1);
  });

  test('creates (not just references) the exam-service and submission-service ECR repos', () => {
    template.resourceCountIs('AWS::ECR::Repository', 2);
    template.hasResourceProperties('AWS::ECR::Repository', { RepositoryName: 'exam-service' });
    template.hasResourceProperties('AWS::ECR::Repository', { RepositoryName: 'submission-service' });
  });

  test('creates two ALB-fronted Fargate services with their own sizing', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 2);
    template.resourceCountIs('AWS::ECS::Service', 2);
    template.hasResourceProperties('AWS::ECS::TaskDefinition', { Cpu: '512', Memory: '1024' });
    template.hasResourceProperties('AWS::ECS::TaskDefinition', { Cpu: '256', Memory: '512' });
  });

  test('both services health check /actuator/health', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/actuator/health',
    });
  });

  test('exam service task role can start the lifecycle state machine', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'states:StartExecution',
            Effect: 'Allow',
            Resource: 'arn:aws:states:ap-southeast-1:111111111111:stateMachine:fixture',
          }),
        ]),
      },
    });
  });

  test('exports both ALB DNS names and the cluster ARN', () => {
    template.hasOutput('ExamServiceAlbDns', {});
    template.hasOutput('SubmissionServiceAlbDns', {});
    template.hasOutput('EcsClusterArn', {});
  });
});
