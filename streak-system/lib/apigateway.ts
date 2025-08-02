import { LambdaRestApi, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { CfnOutput } from "aws-cdk-lib";
import { Model, JsonSchemaType, JsonSchemaVersion } from "aws-cdk-lib/aws-apigateway";
import { RequestValidator } from "aws-cdk-lib/aws-apigateway";

interface StreakApiGatewayProps {
  streakTrackHandler: IFunction;
  streakFreezeHandler: IFunction;
  streakGamePlayHandler: IFunction;
}

export class StreakApiGateway extends Construct {
  constructor(scope: Construct, id: string, props: StreakApiGatewayProps) {
    super(scope, id);

    const api = new LambdaRestApi(this, 'StreakApi', {
      handler: props.streakTrackHandler,
      restApiName: 'Streak Service',
      proxy: false
    });



    // Streak endpoints
    const streak = api.root.addResource('streak');

    const streakTrack = streak.addResource('track');
    streakTrack.addMethod('POST', new LambdaIntegration(props.streakTrackHandler), {
      operationName: 'UpdateStreak',
      requestParameters: {
        'method.request.header.Content-Type': true
      },
      requestModels: {
        'application/json': new Model(this, 'TrackRequestModel', {
          restApi: api,
          contentType: 'application/json',
          schema: {
            schema: JsonSchemaVersion.DRAFT4,
            title: 'TrackStreakRequest',
            type: JsonSchemaType.OBJECT,
            properties: {
              userId: { type: JsonSchemaType.STRING }
            },
            required: ['userId']
          }
        })
      }
    });

    const streakFreeze = streak.addResource('freeze');
    streakFreeze.addMethod('POST', new LambdaIntegration(props.streakFreezeHandler), {
      operationName: 'FreezeStreak',
      requestValidator: new RequestValidator(this, 'FreezeValidator', {
        restApi: api,
        validateRequestBody: true,
        validateRequestParameters: true
      }),
      requestModels: {
        'application/json': new Model(this, 'FreezeRequestModel', {
          restApi: api,
          contentType: 'application/json',
          schema: {
            schema: JsonSchemaVersion.DRAFT4,
            title: 'FreezeStreakRequest',
            type: JsonSchemaType.OBJECT,
            properties: {
              userId: { type: JsonSchemaType.STRING },
              action: {
                type: JsonSchemaType.STRING,
                enum: ['add', 'use']
              }
            },
            required: ['userId', 'action']
          }
        })
      }
    });

    const streakGamePlay = streak.addResource('gamePlay');
    streakGamePlay.addMethod('POST', new LambdaIntegration(props.streakGamePlayHandler), {
      operationName: 'GameWinStreak',
      requestModels: {
        'application/json': new Model(this, 'GameWinRequestModel', {
          restApi: api,
          contentType: 'application/json',
          schema: {
            schema: JsonSchemaVersion.DRAFT4,
            title: 'GameWinStreakRequest',
            type: JsonSchemaType.OBJECT,
            properties: {
              userId: { type: JsonSchemaType.STRING },
              won: { type: JsonSchemaType.BOOLEAN }
            },
            required: ['userId', 'won']
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