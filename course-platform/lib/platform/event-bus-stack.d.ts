import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';
export interface EventBusStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
}
/**
 * Shared EventBridge bus every microservice publishes domain events onto and the
 * analytics microservice consumes from -- the "global dependency that no microservice
 * has a hard dependency on" (Serverless Architectures on AWS, 2nd Ed., Fig 5.5) applied
 * to event fan-out instead of the book's Redshift ETL pull.
 */
export declare class EventBusStack extends cdk.Stack {
    readonly bus: events.EventBus;
    constructor(scope: Construct, id: string, props: EventBusStackProps);
}
