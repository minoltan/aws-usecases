import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
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
export class VideoDataStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly rawUploadsBucket: s3.Bucket;
  public readonly transcodedBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: VideoDataStackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'VideoTable', {
      tableName: `video-${props.envConfig.envName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: props.envConfig.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Video-catalog-by-course lookups: GSI1PK = COURSE#<courseId>, GSI1SK = VIDEO#<videoId>
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    this.rawUploadsBucket = new s3.Bucket(this, 'RawUploadsBucket', {
      bucketName: `course-platform-raw-uploads-${props.envConfig.envName}-${cdk.Aws.ACCOUNT_ID}`,
      eventBridgeEnabled: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      lifecycleRules: [{ expiration: cdk.Duration.days(7) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envConfig.envName !== 'prod',
    });

    this.transcodedBucket = new s3.Bucket(this, 'TranscodedOutputBucket', {
      bucketName: `course-platform-transcoded-${props.envConfig.envName}-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envConfig.envName !== 'prod',
    });

    this.distribution = new cloudfront.Distribution(this, 'VideoDistribution', {
      comment: `course-platform-${props.envConfig.envName} transcoded video delivery`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.transcodedBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'video');
  }
}
