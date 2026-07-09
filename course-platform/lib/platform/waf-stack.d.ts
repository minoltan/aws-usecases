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
export declare class WafStack extends cdk.Stack {
    readonly webAcl: wafv2.CfnWebACL;
    constructor(scope: Construct, id: string, props: WafStackProps);
}
