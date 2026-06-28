import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface WafStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
}

/**
 * CLOUDFRONT-scoped WAFv2 Web ACLs must be created in us-east-1 regardless of
 * where the distribution's other resources live, so this stack is always
 * deployed with env.region = 'us-east-1' (see bin/app.ts) and its ARN is
 * passed cross-region into ApiStack via crossRegionReferences.
 */
export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    this.webAcl = new wafv2.CfnWebACL(this, 'StudentFacingWebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${props.envConfig.domainPrefix}-waf`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-WebAclArn`,
    });
  }
}
