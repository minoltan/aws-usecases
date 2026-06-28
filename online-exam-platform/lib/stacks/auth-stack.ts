import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { join } from 'path';
import { EnvironmentConfig } from '../config/environment';

export interface AuthStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  table: dynamodb.ITable;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly authorizerFn: NodejsFunction;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'StudentUserPool', {
      userPoolName: `${props.envConfig.domainPrefix}-students`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireLowercase: false,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        props.envConfig.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient('StudentBrowserClient', {
      userPoolClientName: `${props.envConfig.domainPrefix}-browser-client`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    this.authorizerFn = new NodejsFunction(this, 'AuthorizerFunction', {
      functionName: `${props.envConfig.domainPrefix}-auth-validator`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, '../../lambda/auth-validator/index.js'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logGroup: new logs.LogGroup(this, 'AuthorizerLogGroup', {
        logGroupName: '/exam-platform/auth-validator',
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        TABLE_NAME: props.table.tableName,
        USER_POOL_ID: this.userPool.userPoolId,
      },
    });

    // GetUser validates the access token's signature/expiry/revocation server-side.
    this.authorizerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:GetUser'],
        resources: [this.userPool.userPoolArn],
      }),
    );
    props.table.grantReadData(this.authorizerFn);

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `ExamPlatform-${props.envConfig.envName}-UserPoolId`,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `ExamPlatform-${props.envConfig.envName}-UserPoolClientId`,
    });
    new cdk.CfnOutput(this, 'AuthorizerArn', {
      value: this.authorizerFn.functionArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-AuthorizerArn`,
    });

    cdk.Tags.of(this).add('Project', 'ExamPlatform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
  }
}
