import * as cdk from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
import { createHandler } from '../../shared/create-handler';
import { createStreamToEventBridgePipe } from '../../shared/create-stream-pipe';

export interface CatalogServiceStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  table: ITable;
  tableStreamArn: string;
  eventBus: events.IEventBus;
  namespace: servicediscovery.HttpNamespace;
}

const EVENT_SOURCE = 'course-platform.course-catalog';

/**
 * Stateless resources for the Course Catalog microservice -- safe to redeploy independently
 * of catalog-data-stack.ts (Serverless Architectures on AWS, 2nd Ed., Fig 5.4).
 */
export class CatalogServiceStack extends cdk.Stack {
  public readonly createCourseFn: NodejsFunction;
  public readonly updateCourseFn: NodejsFunction;
  public readonly getCourseFn: NodejsFunction;
  public readonly listCoursesFn: NodejsFunction;
  public readonly addLessonFn: NodejsFunction;

  constructor(scope: Construct, id: string, props: CatalogServiceStackProps) {
    super(scope, id, props);

    const environment = {
      TABLE_NAME: props.table.tableName,
      EVENT_BUS_NAME: props.eventBus.eventBusName,
      EVENT_SOURCE,
    };

    this.createCourseFn = createHandler(this, 'CreateCourseFunction', {
      domain: 'course-catalog',
      name: 'createCourse',
      environment,
    });
    this.updateCourseFn = createHandler(this, 'UpdateCourseFunction', {
      domain: 'course-catalog',
      name: 'updateCourse',
      environment,
    });
    this.getCourseFn = createHandler(this, 'GetCourseFunction', {
      domain: 'course-catalog',
      name: 'getCourse',
      environment,
    });
    this.listCoursesFn = createHandler(this, 'ListCoursesFunction', {
      domain: 'course-catalog',
      name: 'listCourses',
      environment,
    });
    this.addLessonFn = createHandler(this, 'AddLessonFunction', {
      domain: 'course-catalog',
      name: 'addLesson',
      environment,
    });
    const updateCourseStatsFn = createHandler(this, 'UpdateCourseStatsFunction', {
      domain: 'course-catalog',
      name: 'updateCourseStats',
      environment,
    });

    props.table.grantReadWriteData(this.createCourseFn);
    props.table.grantReadWriteData(this.updateCourseFn);
    props.table.grantReadData(this.getCourseFn);
    props.table.grantReadData(this.listCoursesFn);
    props.table.grantReadWriteData(this.addLessonFn);
    props.table.grantReadWriteData(updateCourseStatsFn);

    props.eventBus.grantPutEventsTo(this.createCourseFn);
    props.eventBus.grantPutEventsTo(this.updateCourseFn);
    props.eventBus.grantPutEventsTo(this.addLessonFn);

    // Reacts to enrollments from another microservice purely off the shared bus -- Course
    // Catalog never calls the Enrollment microservice directly.
    new events.Rule(this, 'EnrollmentCreatedRule', {
      eventBus: props.eventBus,
      eventPattern: {
        source: ['course-platform.enrollment'],
        detailType: ['Enrollment.EnrollmentCreated'],
      },
      targets: [new targets.LambdaFunction(updateCourseStatsFn)],
    });

    createStreamToEventBridgePipe(this, 'CourseCatalogStreamPipe', {
      tableStreamArn: props.tableStreamArn,
      eventBus: props.eventBus,
      source: EVENT_SOURCE,
      detailType: 'CourseCatalogDataChanged',
    });

    const cmService = props.namespace.createService('CourseCatalogRegistry', {
      name: 'course-catalog',
      description: 'Course Catalog microservice',
    });
    cmService.registerNonIpInstance('Instance', {
      customAttributes: {
        LAMBDA_ENTRYPOINT_ARN: this.getCourseFn.functionArn,
        SCHEMA_VERSION: '1.0',
      },
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'course-catalog');
  }
}
