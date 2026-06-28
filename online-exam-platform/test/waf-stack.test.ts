import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { WafStack } from '../lib/stacks/waf-stack';
import { testEnvConfig } from './fixtures';

describe('WafStack', () => {
  const app = new cdk.App();
  const stack = new WafStack(app, 'TestWafStack', {
    env: { account: testEnvConfig.account, region: 'us-east-1' },
    envConfig: testEnvConfig,
  });
  const template = Template.fromStack(stack);

  test('creates a CLOUDFRONT-scoped Web ACL with the AWS common rule set', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'CLOUDFRONT',
      Rules: [
        {
          Name: 'AWSManagedRulesCommonRuleSet',
          Statement: {
            ManagedRuleGroupStatement: { VendorName: 'AWS', Name: 'AWSManagedRulesCommonRuleSet' },
          },
        },
      ],
    });
  });

  test('exports the Web ACL ARN', () => {
    template.hasOutput('WebAclArn', {});
  });
});
