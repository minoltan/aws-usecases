import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StreakApiGateway } from './apigateway';
import { StreakMicroservices } from './microservice';
import { StreakDatabase } from './database';

export class StreakSystemStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Database Tables
    const database = new StreakDatabase(this, 'StreakDatabase');

    // Microservices
    const microservices = new StreakMicroservices(this, 'StreakMicroservices', {
      streakTable: database.streakTable
    });


   // API Gateway
    new StreakApiGateway(this, 'StreakApiGateway', {
      streakTrackHandler: microservices.streakTrackHandler,
      streakFreezeHandler: microservices.streakFreezeHandler,
      streakGamePlayHandler: microservices.streakGamePlayHandler
    });

     // Outputs
    new CfnOutput(this, 'StreakTrackApiUrl', {
      value: microservices.streakTrackHandler.functionArn,
      description: 'Streak Track API Endpoint'
    });

     new CfnOutput(this, 'StreakFreezeApiUrl', {
      value: microservices.streakFreezeHandler.functionArn,
      description: 'Streak Freeze API Endpoint'
    });
  }
}
