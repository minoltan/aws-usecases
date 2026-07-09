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
export class AnalyticsDataStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AnalyticsDataStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'AnalyticsDataLakeBucket', {
      bucketName: `course-platform-analytics-${props.envConfig.envName}-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          transitions: [
            { storageClass: s3.StorageClass.INTELLIGENT_TIERING, transitionAfter: cdk.Duration.days(30) },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envConfig.envName !== 'prod',
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'analytics');
  }
}
