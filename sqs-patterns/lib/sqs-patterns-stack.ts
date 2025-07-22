// lib/stack.ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EcommerceQueue } from './queue';
import { EcommerceApiGateway } from './apigateway';
import { EcommerceMicroservices } from './microservice';
import { EcommerceDatabase } from './database';
import { EcommerceStorage } from './storage';

export class SqsPatternsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. First create database tables
    const database = new EcommerceDatabase(this, 'Database');

    // Storage (S3 Bucket)
    const storage = new EcommerceStorage(this, 'Storage');

    // 2. Create queues (without consumers initially)
    const queues = new EcommerceQueue(this, 'Queues');

    // 3. Create microservices with the actual queues
    const microservices = new EcommerceMicroservices(this, 'Microservices', {
      orderTable: database.orderTable,
      paymentTable: database.paymentTable,
      productTable: database.productTable,
      orderQueue: queues.orderQueue,
      paymentQueue: queues.paymentQueue,
      imageProcessingQueue: queues.imageProcessingQueue,
      uploadBucket: storage.uploadBucket
    });

    // 4. Configure queue consumers after microservices are created
    queues.configureConsumers({
      orderConsumer: microservices.orderProcessor,
      paymentConsumer: microservices.paymentProcessor,
      imageProcessor: microservices.imageProcessor
    });

    // 5. Create API Gateway
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