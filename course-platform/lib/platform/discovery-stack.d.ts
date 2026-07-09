import * as cdk from 'aws-cdk-lib';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';
export interface DiscoveryStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
}
/**
 * AWS Cloud Map service registry -- the direct modern replacement for the book's in-house
 * "Sputnik" service discovery service (Serverless Architectures on AWS, 2nd Ed., 5.1.4: "AWS
 * has a service called Cloud Map... if you're looking for something like Sputnik, check out
 * Cloud Map"). Each microservice's service-stack registers itself here so the registry stays
 * an accurate directory of what services/schemas exist -- the AppSync BFF's actual routing to
 * each microservice's Lambda still uses direct CDK construct references (deploy-time, not a
 * runtime lookup), matching the scope Sputnik itself had in the book (a directory, not the
 * invocation path).
 */
export declare class DiscoveryStack extends cdk.Stack {
    readonly namespace: servicediscovery.HttpNamespace;
    constructor(scope: Construct, id: string, props: DiscoveryStackProps);
}
