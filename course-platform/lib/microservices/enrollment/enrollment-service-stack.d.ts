import * as cdk from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface EnrollmentServiceStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
    table: ITable;
    tableStreamArn: string;
    eventBus: events.IEventBus;
    namespace: servicediscovery.HttpNamespace;
}
/**
 * Enrollment & Payments is the one microservice with a plain HTTP endpoint alongside its
 * AppSync-fronted operations: payment webhooks are fired by an external payment provider
 * that cannot call GraphQL, so `paymentWebhook` gets its own HttpApi route rather than a
 * resolver -- a deliberate, documented exception to the "everything through AppSync" rule.
 */
export declare class EnrollmentServiceStack extends cdk.Stack {
    readonly enrollFn: NodejsFunction;
    readonly getEnrollmentFn: NodejsFunction;
    readonly listEnrollmentsForUserFn: NodejsFunction;
    readonly cancelEnrollmentFn: NodejsFunction;
    readonly webhookUrl: string;
    constructor(scope: Construct, id: string, props: EnrollmentServiceStackProps);
}
