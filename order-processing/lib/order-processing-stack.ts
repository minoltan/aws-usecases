import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as path from 'path';

// This account has no on-demand throughput quota for Nova Lite in any region (confirmed via
// Bedrock console > Quotas - On-demand shows 0 TPM/RPM with no increase path). It must be
// invoked through this US cross-region inference profile instead of the bare model ID.
const BEDROCK_INFERENCE_PROFILE_ID = 'us.amazon.nova-lite-v1:0';

// SES is in sandbox mode for this account, so both the sender and recipient must be verified
// identities. This demo uses one verified address as both. Verification requires manually
// clicking the link AWS emails to this address after `cdk deploy`.
const NOTIFICATION_EMAIL = 'issackpaul95@gmail.com';

export class OrderProcessingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Permanent order record store, surviving past the durable execution's retention period
    const ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      tableName: 'orders',
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Product stock levels. One item per product (partitionKey productId,
    // attribute quantity) so reservation/release can use a conditional
    // UpdateItem to atomically check-and-decrement/increment per product.
    const inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      tableName: 'inventory',
      partitionKey: { name: 'productId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Topic for order status notifications and CloudWatch alarm actions
    const orderStatusTopic = new sns.Topic(this, 'OrderStatusTopic', {
      topicName: 'order-status-topic',
    });

    // Dead-letter queue for failed asynchronous order-processor invocations
    const orderProcessorDlq = new sqs.Queue(this, 'OrderProcessorDLQ', {
      queueName: 'order-processor-dlq',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Explicitly create and manage log groups with proper cleanup on destroy
    const paymentProcessorLogGroup = new logs.LogGroup(this, 'PaymentProcessorLogGroup', {
      logGroupName: '/aws/lambda/payment-processor',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Define the Payment Processor durable Lambda function
    const paymentProcessor = new nodejs.NodejsFunction(this, 'PaymentProcessorFunction', {
      functionName: 'payment-processor',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambda', 'payment-processor.ts'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      durableConfig: {
        executionTimeout: cdk.Duration.minutes(10),
        retentionPeriod: cdk.Duration.days(1),
      },
      bundling: {
        minify: true,
        sourceMap: true,
        format: nodejs.OutputFormat.ESM,
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        externalModules: [], // Bundle all dependencies
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
      logGroup: paymentProcessorLogGroup, // Link to our managed log group
    });

    // Add durable execution policy to payment processor
    paymentProcessor.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicDurableExecutionRolePolicy')
    );

    const orderProcessorLogGroup = new logs.LogGroup(this, 'OrderProcessorLogGroup', {
      logGroupName: '/aws/lambda/order-processor',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Define the Order Processor durable Lambda function
    const orderProcessor = new nodejs.NodejsFunction(this, 'OrderProcessorFunction', {
      functionName: 'order-processor',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambda', 'order-processor.ts'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      durableConfig: {
        executionTimeout: cdk.Duration.minutes(15),
        retentionPeriod: cdk.Duration.days(1),
      },
      bundling: {
        minify: true,
        sourceMap: true,
        format: nodejs.OutputFormat.ESM,
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        externalModules: [], // Bundle all dependencies
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        PAYMENT_PROCESSOR_FUNCTION_NAME: `${paymentProcessor.functionName}:$LATEST`,
        BEDROCK_MODEL_ID: BEDROCK_INFERENCE_PROFILE_ID,
        ORDERS_TABLE_NAME: ordersTable.tableName,
        ORDER_STATUS_TOPIC_ARN: orderStatusTopic.topicArn,
        INVENTORY_TABLE_NAME: inventoryTable.tableName,
      },
      logGroup: orderProcessorLogGroup, // Link to our managed log group
      deadLetterQueueEnabled: true,
      deadLetterQueue: orderProcessorDlq,
    });

    // Add durable execution policy to order processor
    orderProcessor.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicDurableExecutionRolePolicy')
    );

    // Grant order processor permission to invoke payment processor
    paymentProcessor.grantInvoke(orderProcessor);

    // Grant order processor permission to invoke Bedrock (Amazon Nova Lite via the US
    // inference profile). Both the profile itself and the underlying per-region foundation
    // models it routes to need bedrock:InvokeModel for the call to succeed.
    orderProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0`,
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${BEDROCK_INFERENCE_PROFILE_ID}`,
        ],
      })
    );

    // Let order processor read the cancelRequested flag (check-cancellation step) and
    // record its own progress/final status; publish notifications
    ordersTable.grantReadWriteData(orderProcessor);
    orderStatusTopic.grantPublish(orderProcessor);

    // Let order processor price/reserve/release stock. grantReadWriteData doesn't cover
    // TransactWriteItems, which reserve/release use to apply every line item atomically.
    inventoryTable.grantReadWriteData(orderProcessor);
    orderProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:TransactWriteItems'],
        resources: [inventoryTable.tableArn],
      })
    );

    // ---------------------------------------------------------------------
    // API Handler - HTTP front door for submitting orders, checking status,
    // and approving/rejecting pending payments
    // ---------------------------------------------------------------------
    const apiHandlerLogGroup = new logs.LogGroup(this, 'ApiHandlerLogGroup', {
      logGroupName: '/aws/lambda/order-api-handler',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const apiHandler = new nodejs.NodejsFunction(this, 'ApiHandlerFunction', {
      functionName: 'order-api-handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambda', 'api-handler.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
        format: nodejs.OutputFormat.ESM,
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        externalModules: [], // Bundle all dependencies
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        ORDERS_TABLE_NAME: ordersTable.tableName,
        ORDER_PROCESSOR_FUNCTION_NAME: `${orderProcessor.functionName}:$LATEST`,
      },
      logGroup: apiHandlerLogGroup,
    });

    ordersTable.grantReadWriteData(apiHandler);
    orderProcessor.grantInvoke(apiHandler);

    const restApi = new apigateway.RestApi(this, 'OrderApi', {
      restApiName: 'order-processing-api',
    });

    const apiHandlerIntegration = new apigateway.LambdaIntegration(apiHandler);

    const orders = restApi.root.addResource('orders');
    orders.addMethod('POST', apiHandlerIntegration);

    const order = orders.addResource('{orderId}');
    order.addMethod('GET', apiHandlerIntegration);

    const cancel = order.addResource('cancel');
    cancel.addMethod('POST', apiHandlerIntegration);

    // ---------------------------------------------------------------------
    // Notifications - forwards every OrderStatusTopic message as an email via
    // SES. AWS emails a verification link to NOTIFICATION_EMAIL after deploy;
    // it must be clicked once before sends succeed (SES sandbox mode).
    // ---------------------------------------------------------------------
    new ses.EmailIdentity(this, 'NotificationEmailIdentity', {
      identity: ses.Identity.email(NOTIFICATION_EMAIL),
    });

    const notificationEmailerLogGroup = new logs.LogGroup(this, 'NotificationEmailerLogGroup', {
      logGroupName: '/aws/lambda/notification-emailer',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const notificationEmailer = new nodejs.NodejsFunction(this, 'NotificationEmailerFunction', {
      functionName: 'notification-emailer',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambda', 'notification-emailer.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
      bundling: {
        minify: true,
        sourceMap: true,
        format: nodejs.OutputFormat.ESM,
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        externalModules: [], // Bundle all dependencies
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        NOTIFICATION_EMAIL: NOTIFICATION_EMAIL,
      },
      logGroup: notificationEmailerLogGroup,
    });

    notificationEmailer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/${NOTIFICATION_EMAIL}`],
      })
    );

    orderStatusTopic.addSubscription(new snsSubscriptions.LambdaSubscription(notificationEmailer));

    // ---------------------------------------------------------------------
    // Observability - dashboard summarizing all 3 functions plus alarms for
    // order-processor errors and undelivered async invocations (DLQ)
    // ---------------------------------------------------------------------
    const dashboard = new cloudwatch.Dashboard(this, 'OrderProcessingDashboard', {
      dashboardName: 'order-processing',
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Invocations',
        left: [orderProcessor.metricInvocations(), paymentProcessor.metricInvocations(), apiHandler.metricInvocations()],
      }),
      new cloudwatch.GraphWidget({
        title: 'Errors',
        left: [orderProcessor.metricErrors(), paymentProcessor.metricErrors(), apiHandler.metricErrors()],
      }),
      new cloudwatch.GraphWidget({
        title: 'Duration',
        left: [orderProcessor.metricDuration(), paymentProcessor.metricDuration(), apiHandler.metricDuration()],
      }),
    );

    const orderProcessorErrorAlarm = new cloudwatch.Alarm(this, 'OrderProcessorErrorAlarm', {
      alarmName: 'order-processor-errors',
      metric: orderProcessor.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    orderProcessorErrorAlarm.addAlarmAction(new cwActions.SnsAction(orderStatusTopic));

    const dlqAlarm = new cloudwatch.Alarm(this, 'OrderProcessorDlqAlarm', {
      alarmName: 'order-processor-dlq-messages',
      metric: orderProcessorDlq.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(5) }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    dlqAlarm.addAlarmAction(new cwActions.SnsAction(orderStatusTopic));

    // Output the function ARNs and names
    new cdk.CfnOutput(this, 'OrderProcessorFunctionArn', {
      value: orderProcessor.functionArn,
      description: 'ARN of the order processor durable Lambda function',
    });

    new cdk.CfnOutput(this, 'OrderProcessorFunctionName', {
      value: orderProcessor.functionName,
      description: 'Name of the order processor durable Lambda function',
    });

    new cdk.CfnOutput(this, 'PaymentProcessorFunctionArn', {
      value: paymentProcessor.functionArn,
      description: 'ARN of the payment processor durable Lambda function',
    });

    new cdk.CfnOutput(this, 'PaymentProcessorFunctionName', {
      value: paymentProcessor.functionName,
      description: 'Name of the payment processor durable Lambda function',
    });

    new cdk.CfnOutput(this, 'OrderApiUrl', {
      value: restApi.url,
      description: 'Base URL of the order processing REST API',
    });

    new cdk.CfnOutput(this, 'OrdersTableName', {
      value: ordersTable.tableName,
      description: 'Name of the DynamoDB table storing order records',
    });

    new cdk.CfnOutput(this, 'InventoryTableName', {
      value: inventoryTable.tableName,
      description: 'Name of the DynamoDB table storing product stock levels',
    });

    new cdk.CfnOutput(this, 'NotificationEmailAddress', {
      value: NOTIFICATION_EMAIL,
      description: 'SES identity for order notifications - check this inbox for the verification email after deploy',
    });
  }
}
