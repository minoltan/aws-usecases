import * as cdk from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface DiscussionServiceStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
    table: ITable;
    tableStreamArn: string;
    eventBus: events.IEventBus;
    namespace: servicediscovery.HttpNamespace;
}
/**
 * Real-time forum -- the direct modern replacement for the book's Firebase-websocket
 * discussion forum (Serverless Architectures on AWS, 2nd Ed., 5.1). `postMessage` is
 * annotated `@aws_subscribe` in the AppSync schema, so posting *is* the thing clients
 * subscribe to; no separate "None" passthrough resolver is needed.
 */
export declare class DiscussionServiceStack extends cdk.Stack {
    readonly createThreadFn: NodejsFunction;
    readonly postMessageFn: NodejsFunction;
    readonly listMessagesFn: NodejsFunction;
    readonly listThreadsFn: NodejsFunction;
    constructor(scope: Construct, id: string, props: DiscussionServiceStackProps);
}
