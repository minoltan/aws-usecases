import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface DataStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class DataStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly questionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const isProd = props.envConfig.envName === 'prod';

    this.table = new dynamodb.Table(this, 'ExamPlatformTable', {
      tableName: 'ExamPlatform',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI1 — admin monitoring: all active sessions for an exam
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2 — sparse index: student result history, sorted by completedAt
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.questionBucket = new s3.Bucket(this, 'QuestionBucket', {
      bucketName: `exam-platform-questions-${props.envConfig.envName}-${cdk.Aws.ACCOUNT_ID}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-TableArn`,
    });
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      exportName: `ExamPlatform-${props.envConfig.envName}-TableName`,
    });
    new cdk.CfnOutput(this, 'TableStreamArn', {
      value: this.table.tableStreamArn ?? '',
      exportName: `ExamPlatform-${props.envConfig.envName}-TableStreamArn`,
    });
    new cdk.CfnOutput(this, 'QuestionBucketArn', {
      value: this.questionBucket.bucketArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-QuestionBucketArn`,
    });
    new cdk.CfnOutput(this, 'QuestionBucketName', {
      value: this.questionBucket.bucketName,
      exportName: `ExamPlatform-${props.envConfig.envName}-QuestionBucketName`,
    });

    cdk.Tags.of(this).add('Project', 'ExamPlatform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
  }
}
