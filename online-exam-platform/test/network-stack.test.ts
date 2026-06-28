import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/stacks/network-stack';
import { testEnvConfig } from './fixtures';

describe('NetworkStack', () => {
  const app = new cdk.App();
  const stack = new NetworkStack(app, 'TestNetworkStack', {
    env: { account: testEnvConfig.account, region: testEnvConfig.region },
    envConfig: testEnvConfig,
  });
  const template = Template.fromStack(stack);

  test('creates a VPC with 2 AZs worth of public + private subnets', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::Subnet', 4);
  });

  test('creates one NAT Gateway per AZ', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 2);
  });

  test('ALB security group allows inbound 80/443 from the internet', () => {
    const sgs = template.findResources('AWS::EC2::SecurityGroup');
    const albSg: any = Object.values(sgs).find((sg: any) =>
      sg.Properties.GroupDescription?.includes('ALB'),
    );
    expect(albSg).toBeDefined();
    expect(albSg.Properties.SecurityGroupIngress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ FromPort: 80 }),
        expect.objectContaining({ FromPort: 443 }),
      ]),
    );
  });

  test('ECS security group only allows traffic from the ALB security group on 8080', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      FromPort: 8080,
      ToPort: 8080,
    });
  });

  test('creates gateway endpoints for DynamoDB/S3 and interface endpoints for SQS/SNS', () => {
    template.resourceCountIs('AWS::EC2::VPCEndpoint', 4);
  });

  test('exports VPC and security group IDs', () => {
    template.hasOutput('VpcId', {});
    template.hasOutput('AlbSecurityGroupId', {});
    template.hasOutput('EcsSecurityGroupId', {});
  });
});
