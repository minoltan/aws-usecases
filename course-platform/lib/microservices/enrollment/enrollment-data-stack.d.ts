import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface EnrollmentDataStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
}
export declare class EnrollmentDataStack extends cdk.Stack {
    readonly table: dynamodb.Table;
    constructor(scope: Construct, id: string, props: EnrollmentDataStackProps);
}
