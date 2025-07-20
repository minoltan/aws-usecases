// lib/microservice.ts
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Duration } from "aws-cdk-lib";

interface EcommerceMicroservicesProps {
    orderTable: ITable;
    paymentTable: ITable;
    productTable: ITable;
    orderQueue: IQueue;
    paymentQueue: IQueue;
    imageProcessingQueue: IQueue;
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
        this.imageUploadHandler = this.createImageUploadHandler(props.imageProcessingQueue);

        // Processors that read from SQS
        this.orderProcessor = this.createOrderProcessor(props.orderQueue, props.orderTable);
        this.paymentProcessor = this.createPaymentProcessor(props.paymentQueue, props.paymentTable);
        this.imageProcessor = this.createImageProcessor(props.imageProcessingQueue, props.productTable);
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

    private createImageUploadHandler(imageQueue: IQueue): NodejsFunction {
        return new NodejsFunction(this, 'ImageUploadHandler', {
            runtime: Runtime.NODEJS_20_X,
            entry: join(__dirname, "../src/image/image-upload.js"),
            environment: {
                IMAGE_QUEUE_URL: imageQueue.queueUrl
            },
            timeout: Duration.seconds(30),
            memorySize: 512
        });
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
            // bundling: {
            //     nodeModules: ['sharp'],
            //     commandHooks: {
            //     beforeInstall: () => [],
            //     beforeBundling: () => [],
            //     afterBundling: (inputDir, outputDir) => [
            //         // Install sharp with platform-specific binaries
            //         `npm install --prefix ${outputDir} --platform=linux --arch=x64 sharp`
            //     ]
            // },
            // forceDockerBundling: true
            // }
        });

        imageQueue.grantConsumeMessages(fn);
        productTable.grantReadWriteData(fn);
        return fn;
    }
}