import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  Cors,
  LambdaIntegration,
  LogGroupLogDestination,
  MethodLoggingLevel,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface ExamPlatformApiGatewayProps {
  startExamFn: NodejsFunction;
  submitExamFn: NodejsFunction;
  getQuestionsFn: NodejsFunction;
  getResultFn: NodejsFunction;
  docsFn: NodejsFunction;
}

export class ExamPlatformApiGateway extends Construct {
  public readonly api: RestApi;

  constructor(scope: Construct, id: string, props: ExamPlatformApiGatewayProps) {
    super(scope, id);

    const logGroup = new LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: '/aws/apigateway/ExamPlatformAPI',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const stageName = 'prod';
    this.api = new RestApi(this, 'ExamPlatformAPI', {
      restApiName: 'ExamPlatformAPI',
      description: 'Online Exam Platform REST API',
      deployOptions: {
        stageName,
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogDestination: new LogGroupLogDestination(logGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      },
    });

    // /exams resource
    const exams = this.api.root.addResource('exams');

    // POST /exams/start
    const start = exams.addResource('start');
    start.addMethod('POST', new LambdaIntegration(props.startExamFn, { proxy: true }));

    // POST /exams/submit
    const submit = exams.addResource('submit');
    submit.addMethod('POST', new LambdaIntegration(props.submitExamFn, { proxy: true }));

    // /exams/{examId}
    const examById = exams.addResource('{examId}');

    // GET /exams/{examId}/questions
    const questions = examById.addResource('questions');
    questions.addMethod('GET', new LambdaIntegration(props.getQuestionsFn, { proxy: true }));

    // GET /exams/{examId}/result/{studentId}
    const result = examById.addResource('result');
    const resultByStudent = result.addResource('{studentId}');
    resultByStudent.addMethod('GET', new LambdaIntegration(props.getResultFn, { proxy: true }));

    // GET /swagger
    const swagger = this.api.root.addResource('swagger');
    swagger.addMethod('GET', new LambdaIntegration(props.docsFn, { proxy: true }));

    // GET /swagger.json
    const swaggerJson = this.api.root.addResource('swagger.json');
    swaggerJson.addMethod('GET', new LambdaIntegration(props.docsFn, { proxy: true }));

    // Update SwaggerUILambda env with the API URL. Built from restApiId
    // directly rather than this.api.url (which resolves through the
    // Deployment/Stage) - the swagger.json GET method below targets this
    // same Lambda, so going through the Stage would create a CDK dependency
    // cycle (Lambda -> Stage -> Deployment -> swagger.json method -> Lambda).
    const region = Stack.of(this).region;
    const urlSuffix = Stack.of(this).urlSuffix;
    const apiBaseUrl = `https://${this.api.restApiId}.execute-api.${region}.${urlSuffix}/${stageName}/`;
    props.docsFn.addEnvironment('API_BASE_URL', apiBaseUrl);

    new CfnOutput(this, 'ApiGatewayURL', {
      value: this.api.url,
      description: 'API Gateway Base URL',
      exportName: 'ExamPlatformApiUrl',
    });

    new CfnOutput(this, 'SwaggerUIURL', {
      value: `${this.api.url}swagger`,
      description: 'Swagger UI URL',
      exportName: 'ExamPlatformSwaggerUrl',
    });
  }
}
