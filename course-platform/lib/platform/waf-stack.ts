import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface WafStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  graphqlApiArn: string;
}

/**
 * REGIONAL WebACL (AppSync APIs, unlike CloudFront distributions, take a regional WAF
 * association -- no us-east-1/cross-region trick needed). This is the "global dependency
 * outside any individual microservice" the book calls out (Serverless Architectures on
 * AWS, 2nd Ed., Fig 5.5); every client request funnels through this single associated API.
 */
export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    this.webAcl = new wafv2.CfnWebACL(this, 'CoursePlatformWebAcl', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `course-platform-${props.envConfig.envName}-waf`,
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
        {
          name: 'AWSManagedRulesRateLimit',
          priority: 1,
          statement: {
            rateBasedStatement: { limit: 2000, aggregateKeyType: 'IP' },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'GraphQLApiWebAclAssociation', {
      resourceArn: props.graphqlApiArn,
      webAclArn: this.webAcl.attrArn,
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      exportName: `course-platform-${props.envConfig.envName}-WebAclArn`,
    });
  }
}
