import { LambdaRestApi, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { CfnOutput } from "aws-cdk-lib";
import { Model, JsonSchemaType, JsonSchemaVersion } from "aws-cdk-lib/aws-apigateway";
import { RequestValidator } from "aws-cdk-lib/aws-apigateway";

interface SpinWheelApiGatewayProps {
  claimSpinWheelHandler: IFunction;
  createSpinWheelPrizeHandler: IFunction;
  getAllSpinWheelPrizeHandler: IFunction;
}

export class SpiWheelApiGateway extends Construct {
  constructor(scope: Construct, id: string, props: SpinWheelApiGatewayProps) {
    super(scope, id);

    const api = new LambdaRestApi(this, 'SpinWheelApi', {
      handler: props.claimSpinWheelHandler,
      restApiName: 'Spin Wheel Service',
      proxy: false
    });



    // Spin Wheel endpoints
    const spinWheel = api.root.addResource('spin-wheel');

    const spinWheelPrize = spinWheel.addResource('prize');

    spinWheel.addMethod('POST', new LambdaIntegration(props.claimSpinWheelHandler));

    spinWheelPrize.addMethod('GET', new LambdaIntegration(props.getAllSpinWheelPrizeHandler));


    spinWheelPrize.addMethod('POST', new LambdaIntegration(props.createSpinWheelPrizeHandler), {
      operationName: 'CreateSpinWheelPrize',
      requestValidator: new RequestValidator(this, 'CreateSpinWheelValidator', {
        restApi: api,
        validateRequestBody: true,
        validateRequestParameters: true
      }),
      requestModels: {
        'application/json': new Model(this, 'createSpinWheelModel', {
          restApi: api,
          contentType: 'application/json',
          schema: {
            schema: JsonSchemaVersion.DRAFT4,
            title: 'CreateSpinWheelPrizeRequest',
            type: JsonSchemaType.OBJECT,
            properties: {
              name: {
                type: JsonSchemaType.STRING,
                minLength: 1,
              },
              stock: {
                type: JsonSchemaType.INTEGER,
                minimum: 0,
              },
              weight: {
                type: JsonSchemaType.NUMBER,
                minimum: 0,
              }
            },
            required: ['name', 'stock', 'weight'],
            additionalProperties: false,
          } 
        })
      }
    });

    new CfnOutput(this, 'StreakApiEndpoint', {
      value: api.url,
      description: 'Streak API Endpoint'
    });
  }
}