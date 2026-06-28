import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { EnvironmentConfig } from '../lib/config/environment';

export const testEnvConfig: EnvironmentConfig = {
  envName: 'dev',
  account: '111111111111',
  region: 'ap-southeast-1',
  domainPrefix: 'exam-dev',
  natGatewayCount: 2,
  examServiceMinCapacity: 2,
  examServiceMaxCapacity: 50,
  submissionServiceMinCapacity: 2,
  submissionServiceMaxCapacity: 30,
  alarmEmail: 'ops-dev@example.com',
};

const testEnv = { account: testEnvConfig.account, region: testEnvConfig.region };

/** A throwaway stack other test fixtures attach to — never asserted on directly. */
export function fixtureStack(app: cdk.App, id = 'FixtureStack'): cdk.Stack {
  return new cdk.Stack(app, id, { env: testEnv });
}

export function fixtureVpc(stack: cdk.Stack): ec2.Vpc {
  return new ec2.Vpc(stack, 'FixtureVpc', { maxAzs: 2, natGateways: 0 });
}

export function fixtureSecurityGroup(stack: cdk.Stack, vpc: ec2.IVpc, id: string): ec2.SecurityGroup {
  return new ec2.SecurityGroup(stack, id, { vpc });
}

export function fixtureTable(stack: cdk.Stack): dynamodb.Table {
  return new dynamodb.Table(stack, 'FixtureTable', {
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
  });
}

export function fixtureBucket(stack: cdk.Stack): s3.Bucket {
  return new s3.Bucket(stack, 'FixtureBucket');
}
