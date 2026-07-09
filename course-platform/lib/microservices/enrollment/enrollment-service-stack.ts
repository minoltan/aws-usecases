import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
import { createHandler } from '../../shared/create-handler';
import { createStreamToEventBridgePipe } from '../../shared/create-stream-pipe';

export interface EnrollmentServiceStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  table: ITable;
  tableStreamArn: string;
  eventBus: events.IEventBus;
  namespace: servicediscovery.HttpNamespace;
}

const EVENT_SOURCE = 'course-platform.enrollment';

/**
 * Enrollment & Payments is the one microservice with a plain HTTP endpoint alongside its
 * AppSync-fronted operations: payment webhooks are fired by an external payment provider
 * that cannot call GraphQL, so `paymentWebhook` gets its own HttpApi route rather than a
 * resolver -- a deliberate, documented exception to the "everything through AppSync" rule.
 */
export class EnrollmentServiceStack extends cdk.Stack {
  public readonly enrollFn: NodejsFunction;
  public readonly getEnrollmentFn: NodejsFunction;
  public readonly listEnrollmentsForUserFn: NodejsFunction;
  public readonly cancelEnrollmentFn: NodejsFunction;
  public readonly webhookUrl: string;

  constructor(scope: Construct, id: string, props: EnrollmentServiceStackProps) {
    super(scope, id, props);

    const environment = {
      TABLE_NAME: props.table.tableName,
      EVENT_BUS_NAME: props.eventBus.eventBusName,
      EVENT_SOURCE,
    };

    this.enrollFn = createHandler(this, 'EnrollFunction', {
      domain: 'enrollment',
      name: 'enroll',
      environment,
    });
    this.getEnrollmentFn = createHandler(this, 'GetEnrollmentFunction', {
      domain: 'enrollment',
      name: 'getEnrollment',
      environment,
    });
    this.listEnrollmentsForUserFn = createHandler(this, 'ListEnrollmentsForUserFunction', {
      domain: 'enrollment',
      name: 'listEnrollmentsForUser',
      environment,
    });
    this.cancelEnrollmentFn = createHandler(this, 'CancelEnrollmentFunction', {
      domain: 'enrollment',
      name: 'cancelEnrollment',
      environment,
    });

    props.table.grantReadWriteData(this.enrollFn);
    props.table.grantReadData(this.getEnrollmentFn);
    props.table.grantReadData(this.listEnrollmentsForUserFn);
    props.table.grantReadWriteData(this.cancelEnrollmentFn);

    props.eventBus.grantPutEventsTo(this.enrollFn);
    props.eventBus.grantPutEventsTo(this.cancelEnrollmentFn);

    // Demo-scope shared secret standing in for the payment provider's webhook signing
    // secret (e.g. Stripe's whsec_*) -- a real deployment would rotate this out-of-band.
    const webhookSecret = new secretsmanager.Secret(this, 'PaymentWebhookSecret', {
      description: 'HMAC secret used to verify inbound payment webhook signatures',
    });

    const paymentWebhookFn = createHandler(this, 'PaymentWebhookFunction', {
      domain: 'enrollment',
      name: 'paymentWebhook',
      environment: {
        ...environment,
        WEBHOOK_SECRET_ARN: webhookSecret.secretArn,
      },
    });
    props.table.grantReadWriteData(paymentWebhookFn);
    props.eventBus.grantPutEventsTo(paymentWebhookFn);
    webhookSecret.grantRead(paymentWebhookFn);

    const httpApi = new apigwv2.HttpApi(this, 'PaymentWebhookApi', {
      apiName: `course-platform-${props.envConfig.envName}-payment-webhook`,
      description: 'Public webhook receiver for payment provider callbacks',
    });
    httpApi.addRoutes({
      path: '/webhooks/payment',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('PaymentWebhookIntegration', paymentWebhookFn),
    });
    this.webhookUrl = `${httpApi.apiEndpoint}/webhooks/payment`;

    createStreamToEventBridgePipe(this, 'EnrollmentStreamPipe', {
      tableStreamArn: props.tableStreamArn,
      eventBus: props.eventBus,
      source: EVENT_SOURCE,
      detailType: 'EnrollmentDataChanged',
    });

    const cmService = props.namespace.createService('EnrollmentRegistry', {
      name: 'enrollment-payments',
      description: 'Enrollment & Payments microservice',
    });
    cmService.registerNonIpInstance('Instance', {
      customAttributes: {
        WEBHOOK_URL: this.webhookUrl,
        LAMBDA_ENTRYPOINT_ARN: this.getEnrollmentFn.functionArn,
      },
    });

    new cdk.CfnOutput(this, 'PaymentWebhookUrl', {
      value: this.webhookUrl,
      exportName: `course-platform-${props.envConfig.envName}-PaymentWebhookUrl`,
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'enrollment');
  }
}
