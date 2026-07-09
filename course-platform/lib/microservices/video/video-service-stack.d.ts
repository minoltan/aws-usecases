import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface VideoServiceStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
    table: ITable;
    tableStreamArn: string;
    rawUploadsBucket: s3.IBucket;
    transcodedBucket: s3.IBucket;
    distribution: cloudfront.IDistribution;
    eventBus: events.IEventBus;
    namespace: servicediscovery.HttpNamespace;
}
/**
 * Stateless resources for Video Upload & Transcode, including the Step Functions +
 * MediaConvert pipeline that modernizes the book's raw Lambda "transcode start/finish"
 * pair (Serverless Architectures on AWS, 2nd Ed., Fig 5.2).
 */
export declare class VideoServiceStack extends cdk.Stack {
    readonly requestVideoUploadFn: NodejsFunction;
    readonly getVideoFn: NodejsFunction;
    readonly listVideosForCourseFn: NodejsFunction;
    readonly stateMachine: sfn.StateMachine;
    constructor(scope: Construct, id: string, props: VideoServiceStackProps);
}
