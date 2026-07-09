import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface AnalyticsDataStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
}
/**
 * Analytics has no business-entity table of its own -- it's a pure sink, mirroring the
 * book's rule that the Redshift warehouse was never queried directly by other
 * microservices (Serverless Architectures on AWS, 2nd Ed., Fig 5.5). Just a data lake bucket.
 */
export declare class AnalyticsDataStack extends cdk.Stack {
    readonly bucket: s3.Bucket;
    constructor(scope: Construct, id: string, props: AnalyticsDataStackProps);
}
