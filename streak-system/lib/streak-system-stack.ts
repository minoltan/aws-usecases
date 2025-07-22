import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StreakApiGateway } from './apigateway';
import { StreakMicroservices } from './microservice';
import { StreakDatabase } from './database';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class StreakSystemStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Database Tables
    const database = new StreakDatabase(this, 'StreakDatabase');

    // Microservices
    const microservices = new StreakMicroservices(this, 'StreakMicroservices', {
      streakTable: database.streakTable,
      rewardTable: database.rewardTable
    });


   // API Gateway
    new StreakApiGateway(this, 'StreakApiGateway', {
      streakUpdateHandler: microservices.streakUpdateHandler,
      milestoneChoiceHandler: microservices.milestoneChoiceHandler,
      freezePurchaseHandler: microservices.freezePurchaseHandler
    });

     // Outputs
    new CfnOutput(this, 'StreakApiUrl', {
      value: microservices.streakUpdateHandler.functionArn,
      description: 'Streak API Endpoint'
    });
  }
}
