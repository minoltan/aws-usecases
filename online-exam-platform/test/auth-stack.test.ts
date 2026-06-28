import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/stacks/auth-stack';
import { fixtureStack, fixtureTable, testEnvConfig } from './fixtures';

describe('AuthStack', () => {
  const app = new cdk.App();
  const fixture = fixtureStack(app, 'AuthFixtureStack');
  const table = fixtureTable(fixture);

  const stack = new AuthStack(app, 'TestAuthStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
    envConfig: testEnvConfig,
    table,
  });
  const template = Template.fromStack(stack);

  test('creates a Cognito user pool with self sign-up disabled and email sign-in', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      UsernameAttributes: ['email'],
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireUppercase: true,
          RequireNumbers: true,
        },
      },
    });
  });

  test('creates a public browser client with no secret', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH']),
    });
  });

  test('deploys a Node.js 20 authorizer Lambda with the table name wired in', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      Environment: {
        Variables: Match.objectLike({ TABLE_NAME: Match.anyValue() }),
      },
    });
  });

  test('grants the authorizer cognito-idp:GetUser scoped to the user pool', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([Match.objectLike({ Action: 'cognito-idp:GetUser' })]),
      },
    });
  });

  test('exports user pool and authorizer identifiers', () => {
    template.hasOutput('UserPoolId', {});
    template.hasOutput('UserPoolClientId', {});
    template.hasOutput('AuthorizerArn', {});
  });
});
