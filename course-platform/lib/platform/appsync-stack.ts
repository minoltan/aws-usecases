import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { join } from 'path';
import { EnvironmentConfig } from '../config/environment';

export interface AppSyncStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  userPool: cognito.IUserPool;
  catalog: {
    createCourseFn: IFunction;
    updateCourseFn: IFunction;
    getCourseFn: IFunction;
    listCoursesFn: IFunction;
    addLessonFn: IFunction;
  };
  video: {
    requestVideoUploadFn: IFunction;
    getVideoFn: IFunction;
    listVideosForCourseFn: IFunction;
  };
  enrollment: {
    enrollFn: IFunction;
    getEnrollmentFn: IFunction;
    listEnrollmentsForUserFn: IFunction;
    cancelEnrollmentFn: IFunction;
  };
  discussion: {
    createThreadFn: IFunction;
    postMessageFn: IFunction;
    listMessagesFn: IFunction;
    listThreadsFn: IFunction;
  };
  analytics: {
    getCourseEnrollmentStatsFn: IFunction;
  };
}

const RESOLVER_CODE = join(__dirname, '../../src/resolvers/invoke-lambda.js');

/**
 * The GraphQL BFF -- the direct modern replacement for the book's Apollo GraphQL library
 * running inside a Lambda behind API Gateway (Serverless Architectures on AWS, 2nd Ed.,
 * 5.1.3), which the book itself says to replace with AppSync once it existed. Every
 * operation gets its own Lambda data source but shares one unit resolver
 * (src/resolvers/invoke-lambda.js): this API invokes each microservice's Lambda directly,
 * skipping the book's inner API-Gateway-per-microservice hop -- an intentional latency/cost
 * optimization made possible by having every microservice inside the same CDK app.
 */
export class AppSyncStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  public readonly internalServiceRole: iam.Role;

  constructor(scope: Construct, id: string, props: AppSyncStackProps) {
    super(scope, id, props);

    this.api = new appsync.GraphqlApi(this, 'CoursePlatformGraphQL', {
      name: `course-platform-${props.envConfig.envName}`,
      definition: appsync.Definition.fromFile(join(__dirname, 'appsync/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool: props.userPool },
        },
        additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
      },
      xrayEnabled: true,
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL },
    });

    // Replaces the book's X-API-Key header between the BFF and each microservice: an
    // internal Lambda (e.g. a future ops tool, or a service reacting to a webhook) would
    // assume this role to call this API under the AWS_IAM auth mode instead of a user's
    // Cognito JWT. Lives here, not in auth-stack.ts, so the role and its grant on this API
    // are in the same stack -- granting cross-stack would create a cyclic dependency, since
    // this stack already depends on auth-stack.ts for the Cognito user pool.
    this.internalServiceRole = new iam.Role(this, 'InternalServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Assumed by internal microservice Lambdas that need to call AppSync via AWS_IAM auth',
    });
    this.api.grant(this.internalServiceRole, appsync.IamResource.all(), 'appsync:GraphQL');

    const { catalog, video, enrollment, discussion, analytics } = props;

    // Course Catalog
    this.addOperation('Query', 'getCourse', catalog.getCourseFn);
    this.addOperation('Query', 'listCourses', catalog.listCoursesFn);
    this.addOperation('Mutation', 'createCourse', catalog.createCourseFn);
    this.addOperation('Mutation', 'updateCourse', catalog.updateCourseFn);
    this.addOperation('Mutation', 'addLesson', catalog.addLessonFn);

    // Video Upload & Transcode
    this.addOperation('Query', 'getVideo', video.getVideoFn);
    this.addOperation('Query', 'listVideosForCourse', video.listVideosForCourseFn);
    this.addOperation('Mutation', 'requestVideoUpload', video.requestVideoUploadFn);

    // Enrollment & Payments
    this.addOperation('Query', 'getEnrollment', enrollment.getEnrollmentFn);
    this.addOperation('Query', 'listEnrollmentsForUser', enrollment.listEnrollmentsForUserFn);
    this.addOperation('Mutation', 'enroll', enrollment.enrollFn);
    this.addOperation('Mutation', 'cancelEnrollment', enrollment.cancelEnrollmentFn);

    // Discussion Forum
    this.addOperation('Query', 'listThreads', discussion.listThreadsFn);
    this.addOperation('Query', 'listMessages', discussion.listMessagesFn);
    this.addOperation('Mutation', 'createThread', discussion.createThreadFn);
    this.addOperation('Mutation', 'postMessage', discussion.postMessageFn);

    // Reporting & Analytics
    this.addOperation('Query', 'getCourseEnrollmentStats', analytics.getCourseEnrollmentStatsFn);

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);

    new cdk.CfnOutput(this, 'GraphQLApiUrl', {
      value: this.api.graphqlUrl,
      exportName: `course-platform-${props.envConfig.envName}-GraphQLApiUrl`,
    });
    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: this.api.apiId,
      exportName: `course-platform-${props.envConfig.envName}-GraphQLApiId`,
    });
  }

  private addOperation(typeName: 'Query' | 'Mutation', fieldName: string, fn: IFunction): void {
    const dataSource = this.api.addLambdaDataSource(`${fieldName}DataSource`, fn);
    dataSource.createResolver(`${fieldName}Resolver`, {
      typeName,
      fieldName,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(RESOLVER_CODE),
    });
  }
}
