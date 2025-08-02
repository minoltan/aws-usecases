import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, BillingMode, ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class StreakDatabase extends Construct {
  public readonly streakTable: ITable;
  public readonly rewardTable: ITable;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    this.streakTable = this.createStreakTable();
  }

  private createStreakTable(): ITable {
    return new Table(this, 'StreakTable', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'streakType', type: AttributeType.STRING },
      tableName: 'UserStreak',
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expireAt', // Auto-clear old streaks
      removalPolicy: RemovalPolicy.DESTROY
    });
  }
}