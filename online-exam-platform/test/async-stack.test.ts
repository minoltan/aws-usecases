import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AsyncStack } from '../lib/stacks/async-stack';
import { fixtureStack, fixtureTable, testEnvConfig } from './fixtures';

describe('AsyncStack', () => {
  const app = new cdk.App();
  const fixture = fixtureStack(app, 'AsyncFixtureStack');
  const table = fixtureTable(fixture);

  const stack = new AsyncStack(app, 'TestAsyncStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
    envConfig: testEnvConfig,
    table,
  });
  const template = Template.fromStack(stack);

  test('creates a submission queue with a DLQ redrive after 3 receives', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: 300,
      RedrivePolicy: Match.objectLike({ maxReceiveCount: 3 }),
    });
    template.resourceCountIs('AWS::SQS::Queue', 2);
  });

  test('creates a notification SNS topic with an email subscription', () => {
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: testEnvConfig.alarmEmail,
    });
  });

  test('result processor is Node.js 20 and batches SQS by 10', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Timeout: 300,
    });
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 10,
    });
  });

  test('auto-submit Lambda can send to the submission queue', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: Match.arrayWith(['sqs:SendMessage']) }),
        ]),
      },
    });
  });

  test('exam lifecycle state machine is STANDARD with retry/catch on every state', () => {
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineType: 'STANDARD',
    });
    const machines = template.findResources('AWS::StepFunctions::StateMachine');
    const definitionString = JSON.stringify(Object.values(machines)[0]);
    expect(definitionString).toContain('Retry');
    expect(definitionString).toContain('Catch');
  });

  test('exports queue, topic, state machine and scheduler role ARNs', () => {
    template.hasOutput('SubmissionQueueArn', {});
    template.hasOutput('StateMachineArn', {});
    template.hasOutput('SchedulerExecutionRoleArn', {});
  });
});
