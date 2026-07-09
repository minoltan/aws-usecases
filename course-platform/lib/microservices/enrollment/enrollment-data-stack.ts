import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';

export interface EnrollmentDataStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

export class EnrollmentDataStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: EnrollmentDataStackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'EnrollmentTable', {
      tableName: `enrollment-${props.envConfig.envName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: props.envConfig.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Course roster lookups: GSI1PK = COURSE#<courseId>, GSI1SK = USER#<userId>
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'enrollment');
  }
}
