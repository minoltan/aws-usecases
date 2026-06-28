import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/stacks/api-stack';
import { fixtureBucket, fixtureStack, fixtureTable, testEnvConfig } from './fixtures';

describe('ApiStack', () => {
  const app = new cdk.App();
  const fixture = fixtureStack(app, 'ApiFixtureStack');
  const table = fixtureTable(fixture);
  const questionBucket = fixtureBucket(fixture);
  const userPool = new cognito.UserPool(fixture, 'FixtureUserPool');
  const authorizerFn = new lambda.Function(fixture, 'FixtureAuthorizerFn', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler = async () => ({});'),
  });

  const stack = new ApiStack(app, 'TestApiStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
    envConfig: testEnvConfig,
    crossRegionReferences: true,
    userPool,
    authorizerFn,
    table,
    questionBucket,
    examServiceAlbDns: 'exam-alb.ap-southeast-1.elb.amazonaws.com',
    submissionServiceAlbDns: 'submission-alb.ap-southeast-1.elb.amazonaws.com',
    webAclArn: 'arn:aws:wafv2:us-east-1:111111111111:global/webacl/fixture/abc123',
  });
  const template = Template.fromStack(stack);

  test('REST API has a TOKEN authorizer with a 300s cache TTL', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      AuthorizerResultTtlInSeconds: 300,
    });
  });

  test('exam/submit/answers/session routes exist under /exams/{examId}', () => {
    const methods = template.findResources('AWS::ApiGateway::Method');
    const httpMethods = Object.values(methods).map((m: any) => m.Properties.HttpMethod);
    expect(httpMethods.filter((m) => m === 'POST').length).toBeGreaterThanOrEqual(3);
    expect(httpMethods).toContain('GET');
  });

  test('REST API stage throttles at 10000 rps / 5000 burst', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      MethodSettings: Match.arrayWith([
        Match.objectLike({ ThrottlingRateLimit: 10000, ThrottlingBurstLimit: 5000 }),
      ]),
    });
  });

  test('AppSync API uses Cognito user pool auth with an IAM additional mode', () => {
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
      AdditionalAuthenticationProviders: [{ AuthenticationType: 'AWS_IAM' }],
    });
  });

  test('defines getSession query and publishSessionUpdate mutation resolvers', () => {
    template.resourceCountIs('AWS::AppSync::Resolver', 2);
  });

  test('DynamoDB streams feed the session-stream-publisher Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      StartingPosition: 'LATEST',
    });
  });

  test('CloudFront distribution is attached to the WAF Web ACL', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        WebACLId: 'arn:aws:wafv2:us-east-1:111111111111:global/webacl/fixture/abc123',
      }),
    });
  });

  test('exports API Gateway URL, AppSync endpoint and CloudFront URL', () => {
    template.hasOutput('ApiGatewayUrl', {});
    template.hasOutput('AppSyncEndpoint', {});
    template.hasOutput('CloudFrontUrl', {});
  });

  test('exposes Swagger docs at /docs and /docs/openapi.json with no authorizer', () => {
    const resources = template.findResources('AWS::ApiGateway::Resource');
    const docsResource = Object.values(resources).find((r: any) => r.Properties.PathPart === 'docs');
    expect(docsResource).toBeDefined();

    const methods = template.findResources('AWS::ApiGateway::Method', {
      Properties: { HttpMethod: 'GET', AuthorizationType: 'NONE' },
    });
    expect(Object.keys(methods).length).toBeGreaterThanOrEqual(2);
  });

  test('exports the Swagger UI URL and AppSync API id for manual testing', () => {
    template.hasOutput('SwaggerUrl', {});
    template.hasOutput('AppSyncApiId', {});
  });
});
