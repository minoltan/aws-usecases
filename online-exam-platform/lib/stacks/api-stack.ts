import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda_event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { join } from 'path';
import { EnvironmentConfig } from '../config/environment';

export interface ApiStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  userPool: cognito.IUserPool;
  authorizerFn: lambda.IFunction;
  table: dynamodb.ITable;
  questionBucket: s3.IBucket;
  examServiceAlbDns: string;
  submissionServiceAlbDns: string;
  webAclArn: string;
}

export class ApiStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly graphqlApi: appsync.GraphqlApi;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.restApi = this.buildRestApi(props);
    this.graphqlApi = this.buildAppSyncApi(props);
    this.distribution = this.buildCloudFront(props);

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.restApi.url,
      exportName: `ExamPlatform-${props.envConfig.envName}-ApiGatewayUrl`,
    });
    new cdk.CfnOutput(this, 'SwaggerUrl', {
      value: `${this.restApi.url}docs`,
      description: 'Swagger UI for the Exam REST API (public, no token required)',
    });
    new cdk.CfnOutput(this, 'AppSyncEndpoint', {
      value: this.graphqlApi.graphqlUrl,
      exportName: `ExamPlatform-${props.envConfig.envName}-AppSyncEndpoint`,
    });
    new cdk.CfnOutput(this, 'AppSyncApiId', {
      value: this.graphqlApi.apiId,
      description: 'Open AWS Console > AppSync > this API > Queries to run/test GraphQL by hand',
    });
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      exportName: `ExamPlatform-${props.envConfig.envName}-CloudFrontUrl`,
    });

    cdk.Tags.of(this).add('Project', 'ExamPlatform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
  }

  private buildRestApi(props: ApiStackProps): apigateway.RestApi {
    const restApi = new apigateway.RestApi(this, 'ExamRestApi', {
      restApiName: `${props.envConfig.domainPrefix}-api`,
      deployOptions: {
        stageName: props.envConfig.envName,
        throttlingRateLimit: 10000,
        throttlingBurstLimit: 5000,
      },
    });

    // Lambda authorizer + REST API live in different stacks, so the invoke
    // permission has to flow API->Auth only. The default Authorizer wiring
    // instead grants apigateway.amazonaws.com a resource-based permission on
    // the Lambda *with this API's ARN as source*, which would force
    // Auth to depend back on Api — a cycle. Passing an assumeRole sidesteps
    // that: the policy granting invoke lives here (an identity-based grant
    // on this role, not a resource policy on the Lambda), so the dependency
    // stays one-directional (Api -> Auth).
    const authorizerInvocationRole = new iam.Role(this, 'AuthorizerInvocationRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    const authorizer = new apigateway.TokenAuthorizer(this, 'StudentAuthorizer', {
      handler: props.authorizerFn,
      resultsCacheTtl: cdk.Duration.seconds(300),
      assumeRole: authorizerInvocationRole,
    });

    const methodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: { 'method.request.path.examId': true },
    };

    // The authorizer resolves the caller's studentId (see auth-validator's
    // `context: { studentId }`) but API Gateway only forwards authorizer
    // context values to the backend if a method explicitly maps them — this
    // header is how the Spring Boot services learn who's calling.
    const backendIntegration = (albDns: string, path: string, httpMethod: string) =>
      new apigateway.HttpIntegration(`http://${albDns}${path}`, {
        httpMethod,
        proxy: true,
        options: {
          requestParameters: {
            'integration.request.path.examId': 'method.request.path.examId',
            'integration.request.header.X-Student-Id': 'context.authorizer.studentId',
          },
        },
      });

    const examId = restApi.root.addResource('exams').addResource('{examId}');

    examId.addResource('start').addMethod(
      'POST',
      backendIntegration(props.examServiceAlbDns, '/exams/{examId}/start', 'POST'),
      methodOptions,
    );
    examId.addResource('answers').addMethod(
      'POST',
      backendIntegration(props.examServiceAlbDns, '/exams/{examId}/answers', 'POST'),
      methodOptions,
    );
    examId.addResource('session').addMethod(
      'GET',
      backendIntegration(props.examServiceAlbDns, '/exams/{examId}/session', 'GET'),
      methodOptions,
    );
    examId.addResource('submit').addMethod(
      'POST',
      backendIntegration(props.submissionServiceAlbDns, '/exams/{examId}/submit', 'POST'),
      methodOptions,
    );

    // Swagger UI — deliberately public (no authorizer) so the API can be
    // browsed/tried without a Cognito token first.
    const docsHandlerFn = new NodejsFunction(this, 'DocsHandlerFunction', {
      functionName: `${props.envConfig.domainPrefix}-docs-handler`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, '../../lambda/docs-handler/index.js'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });
    const docsIntegration = new apigateway.LambdaIntegration(docsHandlerFn);
    const docs = restApi.root.addResource('docs');
    docs.addMethod('GET', docsIntegration);
    docs.addResource('openapi.json').addMethod('GET', docsIntegration);

    return restApi;
  }

  private buildAppSyncApi(props: ApiStackProps): appsync.GraphqlApi {
    const api = new appsync.GraphqlApi(this, 'ExamProgressApi', {
      name: `${props.envConfig.domainPrefix}-progress-api`,
      definition: appsync.Definition.fromFile(join(__dirname, '../appsync/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool: props.userPool },
        },
        additionalAuthorizationModes: [{ authorizationType: appsync.AuthorizationType.IAM }],
      },
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ERROR },
    });

    const tableDataSource = api.addDynamoDbDataSource('SessionTableDataSource', props.table);
    tableDataSource.createResolver('GetSessionResolver', {
      typeName: 'Query',
      fieldName: 'getSession',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(join(__dirname, '../appsync/resolvers/get-session.js')),
    });

    const noneDataSource = api.addNoneDataSource('LocalDataSource');
    noneDataSource.createResolver('PublishSessionUpdateResolver', {
      typeName: 'Mutation',
      fieldName: 'publishSessionUpdate',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(join(__dirname, '../appsync/resolvers/publish-session-update.js')),
    });

    // DynamoDB Streams -> this Lambda -> signed Mutation.publishSessionUpdate
    // call -> fans out to onSessionUpdated subscribers in real time.
    const streamPublisherFn = new NodejsFunction(this, 'SessionStreamPublisherFunction', {
      functionName: `${props.envConfig.domainPrefix}-session-stream-publisher`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: join(__dirname, '../../lambda/session-stream-publisher/index.js'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        APPSYNC_GRAPHQL_ENDPOINT: api.graphqlUrl,
      },
    });
    api.grantMutation(streamPublisherFn, 'publishSessionUpdate');

    streamPublisherFn.addEventSource(
      new lambda_event_sources.DynamoEventSource(props.table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 50,
        retryAttempts: 3,
        filters: [lambda.FilterCriteria.filter({ dynamodb: { NewImage: { Type: { S: lambda.FilterRule.isEqual('SESSION') } } } })],
      }),
    );

    return api;
  }

  private buildCloudFront(props: ApiStackProps): cloudfront.Distribution {
    const distribution = new cloudfront.Distribution(this, 'ExamPlatformDistribution', {
      comment: `${props.envConfig.domainPrefix} exam platform CDN`,
      webAclId: props.webAclArn,
      defaultBehavior: {
        // S3BucketOrigin (OAC) grants CloudFront read access via a bucket
        // policy scoped to this distribution's ARN — since the bucket lives
        // in DataStack, that statement would create Data->Api, and Api
        // already depends on Data (via Exam->Data), a cycle across stacks.
        // The legacy OAI-based origin grants a stack-agnostic canonical user
        // instead, so it stays deprecated-but-cycle-free here.
        origin: new origins.S3Origin(props.questionBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        'api/*': {
          origin: new origins.RestApiOrigin(this.restApi),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    return distribution;
  }
}
