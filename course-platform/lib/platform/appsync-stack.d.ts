import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';
export interface AppSyncStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
    userPool: cognito.IUserPool;
    catalog: {
        createCourseFn: IFunction;
        updateCourseFn: IFunction;
        getCourseFn: IFunction;
        listCoursesFn: IFunction;
        addLessonFn: IFunction;
    };
    video: {
        requestVideoUploadFn: IFunction;
        getVideoFn: IFunction;
        listVideosForCourseFn: IFunction;
    };
    enrollment: {
        enrollFn: IFunction;
        getEnrollmentFn: IFunction;
        listEnrollmentsForUserFn: IFunction;
        cancelEnrollmentFn: IFunction;
    };
    discussion: {
        createThreadFn: IFunction;
        postMessageFn: IFunction;
        listMessagesFn: IFunction;
        listThreadsFn: IFunction;
    };
    analytics: {
        getCourseEnrollmentStatsFn: IFunction;
    };
}
/**
 * The GraphQL BFF -- the direct modern replacement for the book's Apollo GraphQL library
 * running inside a Lambda behind API Gateway (Serverless Architectures on AWS, 2nd Ed.,
 * 5.1.3), which the book itself says to replace with AppSync once it existed. Every
 * operation gets its own Lambda data source but shares one unit resolver
 * (src/resolvers/invoke-lambda.js): this API invokes each microservice's Lambda directly,
 * skipping the book's inner API-Gateway-per-microservice hop -- an intentional latency/cost
 * optimization made possible by having every microservice inside the same CDK app.
 */
export declare class AppSyncStack extends cdk.Stack {
    readonly api: appsync.GraphqlApi;
    readonly internalServiceRole: iam.Role;
    constructor(scope: Construct, id: string, props: AppSyncStackProps);
    private addOperation;
}
