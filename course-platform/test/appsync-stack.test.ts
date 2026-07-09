import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { AppSyncStack } from '../lib/platform/appsync-stack';
import { testEnvConfig } from './fixtures';

describe('AppSyncStack', () => {
  const app = new cdk.App();
  const supportStack = new cdk.Stack(app, 'TestSupportStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
  });

  const userPool = new cognito.UserPool(supportStack, 'TestUserPool');

  const fn = (id: string) =>
    lambda.Function.fromFunctionArn(
      supportStack,
      id,
      `arn:aws:lambda:${testEnvConfig.region}:${testEnvConfig.account}:function:${id}`
    );

  const stack = new AppSyncStack(app, 'TestAppSyncStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
    envConfig: testEnvConfig,
    userPool,
    catalog: {
      createCourseFn: fn('CreateCourseFn'),
      updateCourseFn: fn('UpdateCourseFn'),
      getCourseFn: fn('GetCourseFn'),
      listCoursesFn: fn('ListCoursesFn'),
      addLessonFn: fn('AddLessonFn'),
    },
    video: {
      requestVideoUploadFn: fn('RequestVideoUploadFn'),
      getVideoFn: fn('GetVideoFn'),
      listVideosForCourseFn: fn('ListVideosForCourseFn'),
    },
    enrollment: {
      enrollFn: fn('EnrollFn'),
      getEnrollmentFn: fn('GetEnrollmentFn'),
      listEnrollmentsForUserFn: fn('ListEnrollmentsForUserFn'),
      cancelEnrollmentFn: fn('CancelEnrollmentFn'),
    },
    discussion: {
      createThreadFn: fn('CreateThreadFn'),
      postMessageFn: fn('PostMessageFn'),
      listMessagesFn: fn('ListMessagesFn'),
      listThreadsFn: fn('ListThreadsFn'),
    },
    analytics: {
      getCourseEnrollmentStatsFn: fn('GetCourseEnrollmentStatsFn'),
    },
  });
  const template = Template.fromStack(stack);

  test('defaults to Cognito user pool auth with IAM as an additional mode', () => {
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
      AdditionalAuthenticationProviders: [{ AuthenticationType: 'AWS_IAM' }],
    });
  });

  test('wires one Lambda data source and one resolver per operation', () => {
    template.resourceCountIs('AWS::AppSync::DataSource', 17);
    template.resourceCountIs('AWS::AppSync::Resolver', 17);
  });
});
