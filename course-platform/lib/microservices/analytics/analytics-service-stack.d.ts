import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface AnalyticsServiceStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
    dataLakeBucket: s3.IBucket;
    eventBus: events.IEventBus;
    namespace: servicediscovery.HttpNamespace;
}
/**
 * The modern replacement for the book's Redshift cluster + scheduled ETL (Serverless
 * Architectures on AWS, 2nd Ed., Fig 5.5): every microservice's domain events (business
 * events + DynamoDB-Streams-via-Pipes CDC events) land on the shared bus; this stack's
 * rule fans them straight into Firehose -> S3, queryable via Glue + Athena. No Lambda
 * sits in the ingest path, and no other microservice has a hard dependency on this one.
 */
export declare class AnalyticsServiceStack extends cdk.Stack {
    readonly getCourseEnrollmentStatsFn: NodejsFunction;
    constructor(scope: Construct, id: string, props: AnalyticsServiceStackProps);
}
