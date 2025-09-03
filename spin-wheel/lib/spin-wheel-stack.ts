import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SpinWheelDatabase } from './database';
import { SpinWheelMicroservices } from './microservices';
import { SpiWheelApiGateway } from './apigateway';

export class SpinWheelStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Database Tables
    const database = new SpinWheelDatabase(this, 'SpinWheelDatabase');

    // Lambdas
    const microservices = new SpinWheelMicroservices(this, 'SpinWheelMicroservices', {
      spinWheelTable: database.spinWheelTable
    });

    // API Gateway
    new SpiWheelApiGateway(this, 'SpiWheelApiGateway', {
      claimSpinWheelHandler: microservices.claimSpinWheelHandler,
      createSpinWheelPrizeHandler: microservices.createSpinWheelPrizeHandler,
      getAllSpinWheelPrizeHandler: microservices.getAllSpinWheelPrizeHandler
    });
  }
}
