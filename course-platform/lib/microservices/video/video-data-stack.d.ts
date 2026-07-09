import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface VideoDataStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
}
/**
 * Stateful resources for Video Upload & Transcode. Replaces the book's raw
 * "upload/transcode start/finish" Lambda pair (Serverless Architectures on AWS, 2nd Ed.,
 * Fig 5.2) with buckets + CloudFront that a Step Functions/MediaConvert pipeline
 * (video-service-stack.ts) drives.
 */
export declare class VideoDataStack extends cdk.Stack {
    readonly table: dynamodb.Table;
    readonly rawUploadsBucket: s3.Bucket;
    readonly transcodedBucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props: VideoDataStackProps);
}
