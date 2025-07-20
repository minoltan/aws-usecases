// lib/queue.ts
import { Duration } from "aws-cdk-lib";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { IQueue, Queue, QueueProps } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

interface EcommerceQueueProps {
    orderConsumer: IFunction;
    paymentConsumer: IFunction;
    imageProcessor: IFunction;
}

export class EcommerceQueue extends Construct {
    public readonly orderQueue: IQueue;
    public readonly paymentQueue: IQueue;
    public readonly imageProcessingQueue: IQueue;

    constructor(scope: Construct, id: string, props: EcommerceQueueProps) {
        super(scope, id);

        // Standard Queue for Order Processing (DB Write Buffer)
        this.orderQueue = new Queue(this, 'OrderQueue', {
            queueName: 'OrderProcessingQueue',
            visibilityTimeout: Duration.minutes(5),
            retentionPeriod: Duration.days(4)
        });

        // FIFO Queue for Payment Processing
        this.paymentQueue = new Queue(this, 'PaymentQueue', {
            queueName: 'PaymentProcessing.fifo',
            fifo: true,
            contentBasedDeduplication: true,
            visibilityTimeout: Duration.minutes(10)
        });

        // Standard Queue for Image Processing
        this.imageProcessingQueue = new Queue(this, 'ImageProcessingQueue', {
            queueName: 'ImageProcessingQueue',
            visibilityTimeout: Duration.minutes(30),
            retentionPeriod: Duration.days(2)
        });

        // Configure event sources
        props.orderConsumer.addEventSource(new SqsEventSource(this.orderQueue, {
            batchSize: 5,
            reportBatchItemFailures: true
        }));

        props.paymentConsumer.addEventSource(new SqsEventSource(this.paymentQueue, {
            batchSize: 1
        }));

        props.imageProcessor.addEventSource(new SqsEventSource(this.imageProcessingQueue, {
            batchSize: 1
        }));
    }
}