// lib/microservice.ts
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Duration } from "aws-cdk-lib";
import { IBucket } from 'aws-cdk-lib/aws-s3';

interface EcommerceMicroservicesProps {
    orderTable: ITable;
    paymentTable: ITable;
    productTable: ITable;
    orderQueue: IQueue;
    paymentQueue: IQueue;
    imageProcessingQueue: IQueue;
    uploadBucket: IBucket;
}

export class EcommerceMicroservices extends Construct {
    public readonly orderSubmitHandler: NodejsFunction;
    public readonly paymentSubmitHandler: NodejsFunction;
    public readonly imageUploadHandler: NodejsFunction;
    public readonly orderProcessor: NodejsFunction;
    public readonly paymentProcessor: NodejsFunction;
    public readonly imageProcessor: NodejsFunction;

    constructor(scope: Construct, id: string, props: EcommerceMicroservicesProps) {
        super(scope, id);

        // Handlers that write to SQS
        this.orderSubmitHandler = this.createOrderSubmitHandler(props.orderQueue);
        this.paymentSubmitHandler = this.createPaymentSubmitHandler(props.paymentQueue);
        this.imageUploadHandler = this.createImageUploadHandler(props.imageProcessingQueue,props.uploadBucket);

        // Processors that read from SQS
        this.orderProcessor = this.createOrderProcessor(props.orderQueue, props.orderTable);
        this.paymentProcessor = this.createPaymentProcessor(props.paymentQueue, props.paymentTable);
        this.imageProcessor = this.createImageProcessor(props.imageProcessingQueue, props.productTable);

        // Grant permissions to the specific handler functions
        props.orderQueue.grantSendMessages(this.orderSubmitHandler);
        props.paymentQueue.grantSendMessages(this.paymentSubmitHandler);
        props.imageProcessingQueue.grantSendMessages(this.imageUploadHandler);
    }

    private createOrderSubmitHandler(orderQueue: IQueue): NodejsFunction {
        return new NodejsFunction(this, 'OrderSubmitHandler', {
            runtime: Runtime.NODEJS_20_X,
            entry: join(__dirname, "../src/order/order-submit.js"),
            environment: {
                ORDER_QUEUE_URL: orderQueue.queueUrl
            },
            timeout: Duration.seconds(30)
        });
    }

    private createPaymentSubmitHandler(paymentQueue: IQueue): NodejsFunction {
        return new NodejsFunction(this, 'PaymentSubmitHandler', {
            runtime: Runtime.NODEJS_20_X,
            entry: join(__dirname, "../src/payment/payment-submit.js"),
            environment: {
                PAYMENT_QUEUE_URL: paymentQueue.queueUrl
            },
            timeout: Duration.seconds(30)
        });
    }

    private createImageUploadHandler(imageQueue: IQueue, uploadBucket: IBucket): NodejsFunction {
       const fn = new NodejsFunction(this, 'ImageUploadHandler', {
            runtime: Runtime.NODEJS_20_X,
            entry: join(__dirname, "../src/image/image-upload.js"),
            environment: {
                IMAGE_QUEUE_URL: imageQueue.queueUrl,
                UPLOAD_BUCKET: uploadBucket.bucketName
            },
            timeout: Duration.seconds(30),
            memorySize: 512
        });

        imageQueue.grantSendMessages(fn);
        uploadBucket.grantPut(fn);
        return fn;
    }

    private createOrderProcessor(orderQueue: IQueue, orderTable: ITable): NodejsFunction {
        const fn = new NodejsFunction(this, 'OrderProcessor', {
            runtime: Runtime.NODEJS_20_X,
            entry: join(__dirname, "../src/order/order-processor.js"),
            environment: {
                ORDER_TABLE_NAME: orderTable.tableName
            },
            timeout: Duration.minutes(1),
            memorySize: 1024
        });

        orderQueue.grantConsumeMessages(fn);
        orderTable.grantReadWriteData(fn);
        return fn;
    }

    private createPaymentProcessor(paymentQueue: IQueue, paymentTable: ITable): NodejsFunction {
        const fn = new NodejsFunction(this, 'PaymentProcessor', {
            runtime: Runtime.NODEJS_20_X,
            entry: join(__dirname, "../src/payment/payment-processor.js"),
            environment: {
                PAYMENT_TABLE_NAME: paymentTable.tableName
            },
            timeout: Duration.minutes(2),
            memorySize: 1024
        });

        paymentQueue.grantConsumeMessages(fn);
        paymentTable.grantReadWriteData(fn);
        return fn;
    }

    private createImageProcessor(imageQueue: IQueue, productTable: ITable): NodejsFunction {
        const fn = new NodejsFunction(this, 'ImageProcessor', {
            runtime: Runtime.NODEJS_20_X,
            entry: join(__dirname, "../src/image/image-processor.js"),
            environment: {
                PRODUCT_TABLE_NAME: productTable.tableName,
                PROCESSING_TIMEOUT: '20'
            },
            timeout: Duration.minutes(5),
            memorySize: 2048
        });

        imageQueue.grantConsumeMessages(fn);
        productTable.grantReadWriteData(fn);
        return fn;
    }
}