import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import { Topic } from "aws-cdk-lib/aws-sns";
import { Duration } from "aws-cdk-lib";

interface StreakMicroservicesProps {
  streakTable: ITable;
  rewardTable: ITable;
}

export class StreakMicroservices extends Construct {
  public readonly streakUpdateHandler: NodejsFunction;
  public readonly milestoneChoiceHandler: NodejsFunction;
  public readonly freezePurchaseHandler: NodejsFunction;

  constructor(scope: Construct, id: string, props: StreakMicroservicesProps) {
    super(scope, id);

    // Notification topic
    const notificationTopic = new Topic(this, 'StreakNotificationTopic');

    // Handlers
    this.streakUpdateHandler = this.createStreakUpdateHandler(props.streakTable, notificationTopic);
    this.milestoneChoiceHandler = this.createMilestoneChoiceHandler(props.streakTable, props.rewardTable);
    this.freezePurchaseHandler = this.createFreezePurchaseHandler(props.streakTable);
  }

  private createStreakUpdateHandler(streakTable: ITable, topic: Topic): NodejsFunction {
    const fn = new NodejsFunction(this, 'StreakUpdateHandler', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/streak/update-streak.ts"),
      environment: {
        STREAK_TABLE_NAME: streakTable.tableName,
        NOTIFICATION_TOPIC_ARN: topic.topicArn
      },
      timeout: Duration.seconds(30)
    });

    streakTable.grantReadWriteData(fn);
    topic.grantPublish(fn);
    return fn;
  }

  private createMilestoneChoiceHandler(streakTable: ITable, rewardTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'MilestoneChoiceHandler', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/milestone/milestone-choice.ts"),
      environment: {
        STREAK_TABLE_NAME: streakTable.tableName,
        REWARD_TABLE_NAME: rewardTable.tableName
      },
      timeout: Duration.seconds(30)
    });

    streakTable.grantReadWriteData(fn);
    rewardTable.grantReadWriteData(fn);
    return fn;
  }

  private createFreezePurchaseHandler(streakTable: ITable): NodejsFunction {
    const fn = new NodejsFunction(this, 'FreezePurchaseHandler', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/freezePurchase/purchase-freeze.ts"),
      environment: {
        STREAK_TABLE_NAME: streakTable.tableName
      },
      timeout: Duration.seconds(30)
    });

    streakTable.grantReadWriteData(fn);
    return fn;
  }
}