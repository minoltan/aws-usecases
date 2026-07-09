import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CatalogDataStack } from '../lib/microservices/course-catalog/catalog-data-stack';
import { testEnvConfig } from './fixtures';

describe('CatalogDataStack', () => {
  const app = new cdk.App();
  const stack = new CatalogDataStack(app, 'TestCatalogDataStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
    envConfig: testEnvConfig,
  });
  const template = Template.fromStack(stack);

  test('creates a single PAY_PER_REQUEST table with PK/SK and streams enabled', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'course-catalog-dev',
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      StreamSpecification: { StreamViewType: 'NEW_AND_OLD_IMAGES' },
    });
  });

  test('defines GSI1 for browse-by-category lookups', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
        },
      ],
    });
  });
});
