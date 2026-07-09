import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface AuthStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

/**
 * Cognito replaces the book's Auth0 (Serverless Architectures on AWS, 2nd Ed., 5.1.5).
 * The internal/service-to-service role (the AWS_IAM-auth replacement for the book's
 * X-API-Key header) lives in appsync-stack.ts instead of here: it's granted permission
 * on the GraphQL API, and a role + a same-stack grant on a resource from a *different*
 * stack would create a cyclic stack dependency (AppSync already depends on this stack's
 * user pool).
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'CoursePlatformUserPool', {
      userPoolName: `course-platform-${props.envConfig.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.envConfig.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient('CoursePlatformWebClient', {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `course-platform-${props.envConfig.envName}-UserPoolId`,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `course-platform-${props.envConfig.envName}-UserPoolClientId`,
    });
  }
}
