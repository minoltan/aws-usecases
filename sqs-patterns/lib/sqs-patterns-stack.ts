// lib/stack.ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcommerceQueue } from './queue';
import { EcommerceApiGateway } from './apigateway';
import { EcommerceMicroservices } from './microservice';
import { EcommerceDatabase } from './database';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export class SqsPatternsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Database Tables
    const database = new EcommerceDatabase(this, 'Database');

    // Create queues and microservices
    const microservices = new EcommerceMicroservices(this, 'Microservices', {
      orderTable: database.orderTable,
      paymentTable: database.paymentTable,
      productTable: database.productTable,
      orderQueue: new Queue(this, 'OrderQueuePlaceholder'),
      paymentQueue: new Queue(this, 'PaymentQueuePlaceholder'),
      imageProcessingQueue: new Queue(this, 'ImageQueuePlaceholder')
    });

    const queues = new EcommerceQueue(this, 'Queues', {
      orderConsumer: microservices.orderProcessor,
      paymentConsumer: microservices.paymentProcessor,
      imageProcessor: microservices.imageProcessor
    });

    // Update microservices with actual queue references
    microservices.node.tryRemoveChild('OrderQueuePlaceholder');
    microservices.node.tryRemoveChild('PaymentQueuePlaceholder');
    microservices.node.tryRemoveChild('ImageQueuePlaceholder');
    (microservices as any).orderQueue = queues.orderQueue;
    (microservices as any).paymentQueue = queues.paymentQueue;
    (microservices as any).imageProcessingQueue = queues.imageProcessingQueue;

    // API Gateway
    new EcommerceApiGateway(this, 'ApiGateway', {
      orderSubmitHandler: microservices.orderSubmitHandler,
      paymentSubmitHandler: microservices.paymentSubmitHandler,
      imageUploadHandler: microservices.imageUploadHandler
    });

    // Outputs
    new CfnOutput(this, 'OrderQueueUrl', {
      value: queues.orderQueue.queueUrl,
      description: 'Order Processing Queue URL'
    });

    new CfnOutput(this, 'PaymentQueueUrl', {
      value: queues.paymentQueue.queueUrl,
      description: 'Payment Processing Queue URL'
    });

    new CfnOutput(this, 'ImageQueueUrl', {
      value: queues.imageProcessingQueue.queueUrl,
      description: 'Image Processing Queue URL'
    });
  }
}