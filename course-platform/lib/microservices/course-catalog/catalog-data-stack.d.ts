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
export declare class CatalogDataStack extends cdk.Stack {
    readonly table: dynamodb.Table;
    constructor(scope: Construct, id: string, props: CatalogDataStackProps);
}
