import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import { Duration } from "aws-cdk-lib";

interface StreakMicroservicesProps {
  streakTable: ITable;
}

export class StreakMicroservices extends Construct {
  public readonly streakTrackHandler: NodejsFunction;
  public readonly streakFreezeHandler: NodejsFunction;
  public readonly streakGamePlayHandler: NodejsFunction;

  constructor(scope: Construct, id: string, props: StreakMicroservicesProps) {
    super(scope, id);

    // Handlers
    this.streakTrackHandler = this.createStreakTrackHandler(props.streakTable);
    this.streakFreezeHandler = this.createStreakFreezeHandler(props.streakTable);
    this.streakGamePlayHandler = this.createStreakGamePlayHandler(props.streakTable);

  }

  private createStreakTrackHandler(streakTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'StreakTrackHandler', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/streakTrack/index.js"),
      environment: {
        STREAK_TABLE_NAME: streakTable.tableName
      },
      timeout: Duration.seconds(30)
    });

    streakTable.grantReadWriteData(fn);
    return fn;
  }

  private createStreakFreezeHandler(streakTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'StreakFreezeHandler', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/streakFreeze/index.js"),
      environment: {
        STREAK_TABLE_NAME: streakTable.tableName
      },
      timeout: Duration.seconds(30)
    });

    streakTable.grantReadWriteData(fn);
    return fn;
  }

  private createStreakGamePlayHandler(streakTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'StreakGamePlayHandler', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/streakGamePlay/index.js"),
      environment: {
        STREAK_TABLE_NAME: streakTable.tableName
      },
      timeout: Duration.seconds(30)
    });

    streakTable.grantReadWriteData(fn);
    return fn;
  }






}