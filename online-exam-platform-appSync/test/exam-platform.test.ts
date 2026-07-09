import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ExamPlatformStack } from '../lib/exam-platform-stack';

test('Exam platform creates DynamoDB tables, state machine, and AppSync API', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new ExamPlatformStack(app, 'MyTestStack', {
    env: { account: '123456789012', region: 'ap-southeast-1' },
  });
  // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'ExamSessions',
  });

  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'ExamAnswers',
  });

  template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);

  template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
    Name: 'ExamPlatformGraphQL',
  });
});
