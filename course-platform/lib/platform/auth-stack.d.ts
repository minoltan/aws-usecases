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
export declare class AuthStack extends cdk.Stack {
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    constructor(scope: Construct, id: string, props: AuthStackProps);
}
