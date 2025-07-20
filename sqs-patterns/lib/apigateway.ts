// lib/apigateway.ts
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { CfnOutput } from "aws-cdk-lib";

interface EcommerceApiGatewayProps {
    orderSubmitHandler: IFunction;
    paymentSubmitHandler: IFunction;
    imageUploadHandler: IFunction;
}

export class EcommerceApiGateway extends Construct {
    constructor(scope: Construct, id: string, props: EcommerceApiGatewayProps) {
        super(scope, id);

        // Order API
        const orderApi = new LambdaRestApi(this, 'OrderApi', {
            handler: props.orderSubmitHandler,
            restApiName: 'Order Service',
            proxy: false
        });

        const orders = orderApi.root.addResource('orders');
        orders.addMethod('POST');

        // Payment API
        const paymentApi = new LambdaRestApi(this, 'PaymentApi', {
            handler: props.paymentSubmitHandler,
            restApiName: 'Payment Service',
            proxy: false
        });

        const payments = paymentApi.root.addResource('payments');
        payments.addMethod('POST');

        // Image Upload API
        const imageApi = new LambdaRestApi(this, 'ImageApi', {
            handler: props.imageUploadHandler,
            restApiName: 'Image Service',
            proxy: false
        });

        const images = imageApi.root.addResource('images');
        images.addMethod('POST');

        // Outputs
        new CfnOutput(this, 'OrderApiUrl', {
            value: orderApi.url,
            description: 'Order API Endpoint'
        });

        new CfnOutput(this, 'PaymentApiUrl', {
            value: paymentApi.url,
            description: 'Payment API Endpoint'
        });

        new CfnOutput(this, 'ImageApiUrl', {
            value: imageApi.url,
            description: 'Image API Endpoint'
        });
    }
}