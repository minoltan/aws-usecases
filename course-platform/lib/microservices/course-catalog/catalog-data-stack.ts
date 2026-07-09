import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';

export interface CatalogDataStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

/**
 * Stateful resources for the Course Catalog microservice -- kept in its own stack so a
 * stateless (service) redeploy can never accidentally touch this table (Serverless
 * Architectures on AWS, 2nd Ed., Fig 5.4).
 */
export class CatalogDataStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: CatalogDataStackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'CourseCatalogTable', {
      tableName: `course-catalog-${props.envConfig.envName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: props.envConfig.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Browse-by-category: GSI1PK = CATEGORY#<category>, GSI1SK = COURSE#<courseId>
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'course-catalog');
  }
}
