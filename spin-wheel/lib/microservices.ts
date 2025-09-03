import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import { Duration } from "aws-cdk-lib";

interface SpinWheelMicroservicesProps {
  spinWheelTable: ITable;
}

export class SpinWheelMicroservices extends Construct {
  public readonly claimSpinWheelHandler: NodejsFunction;
  public readonly createSpinWheelPrizeHandler: NodejsFunction;
  public readonly getSpinWheelPrizeHandler: NodejsFunction;

  constructor(scope: Construct, id: string, props: SpinWheelMicroservicesProps) {
    super(scope, id);

    // Lambdas
    this.claimSpinWheelHandler = this.createClaimSpinWheelLambda(props.spinWheelTable);
    this.createSpinWheelPrizeHandler = this.createSpinWheelPrizeLambda(props.spinWheelTable);
    this.getSpinWheelPrizeHandler = this.createGetSpinWheelPrizeLambda(props.spinWheelTable);

  }

  private createClaimSpinWheelLambda(spinWheelTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'claimSpinWheel', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/spin/claimSpinWheelPrize/index.js"),
      environment: {
        DYNAMO_TABLE_NAME: spinWheelTable.tableName
      },
      timeout: Duration.seconds(30)
    });

    spinWheelTable.grant(fn, 'dynamodb:GetItem');
    spinWheelTable.grant(fn, 'dynamodb:Query');
    spinWheelTable.grant(fn, 'dynamodb:UpdateItem');
    return fn;
  }

  private createSpinWheelPrizeLambda(spinWheelTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'createSpinWheelPrize', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/prize/createSpinWheelPrize/index.js"),
      environment: {
        DYNAMO_TABLE_NAME: spinWheelTable.tableName
      },
      timeout: Duration.seconds(30)
    });

    spinWheelTable.grant(fn, 'dynamodb:PutItem');
    return fn;
  }

  private createGetSpinWheelPrizeLambda(spinWheelTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'getAllSpinWheelPrizes', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/prize/getAllSpinWheelPrizes/index.js"),
      environment: {
        DYNAMO_TABLE_NAME: spinWheelTable.tableName
      },
      timeout: Duration.seconds(30)
    });

     spinWheelTable.grant(fn, 'dynamodb:Query');
    return fn;
  }






}