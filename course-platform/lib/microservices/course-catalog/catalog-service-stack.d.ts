import * as cdk from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
export interface CatalogServiceStackProps extends cdk.StackProps {
    envConfig: EnvironmentConfig;
    table: ITable;
    tableStreamArn: string;
    eventBus: events.IEventBus;
    namespace: servicediscovery.HttpNamespace;
}
/**
 * Stateless resources for the Course Catalog microservice -- safe to redeploy independently
 * of catalog-data-stack.ts (Serverless Architectures on AWS, 2nd Ed., Fig 5.4).
 */
export declare class CatalogServiceStack extends cdk.Stack {
    readonly createCourseFn: NodejsFunction;
    readonly updateCourseFn: NodejsFunction;
    readonly getCourseFn: NodejsFunction;
    readonly listCoursesFn: NodejsFunction;
    readonly addLessonFn: NodejsFunction;
    constructor(scope: Construct, id: string, props: CatalogServiceStackProps);
}
