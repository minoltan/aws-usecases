import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, BillingMode, ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class SpinWheelDatabase extends Construct {
  public readonly spinWheelTable: ITable;

  constructor(scope: Construct, id: string) {
    super(scope, id);
     this.spinWheelTable = this.createSpinWheelTable();
  }

  private createSpinWheelTable(): ITable {
    return new Table(this, 'SpinWheelTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING }, // I am using partition key as PK
      sortKey: { name: 'SK', type: AttributeType.STRING }, // I am using sort key as SK
      tableName: 'SpinWheel',
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });
  }
}