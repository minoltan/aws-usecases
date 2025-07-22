import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { CfnOutput } from "aws-cdk-lib";

interface StreakApiGatewayProps {
  streakUpdateHandler: IFunction;
  milestoneChoiceHandler: IFunction;
  freezePurchaseHandler: IFunction;
}

export class StreakApiGateway extends Construct {
  constructor(scope: Construct, id: string, props: StreakApiGatewayProps) {
    super(scope, id);

    const api = new LambdaRestApi(this, 'StreakApi', {
      handler: props.streakUpdateHandler,
      restApiName: 'Streak Service',
      proxy: false
    });

    // Streak endpoints
    const streak = api.root.addResource('streak');
    streak.addMethod('POST'); // Update streak

    const milestone = streak.addResource('milestone');
    milestone.addMethod('POST'); // Handle milestone choice

    const freeze = streak.addResource('freeze');
    freeze.addMethod('POST'); // Purchase freeze

    new CfnOutput(this, 'StreakApiEndpoint', {
      value: api.url,
      description: 'Streak API Endpoint'
    });
  }
}