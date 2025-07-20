// lib/database.ts
import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, BillingMode, ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class EcommerceDatabase extends Construct {
    public readonly orderTable: ITable;
    public readonly paymentTable: ITable;
    public readonly productTable: ITable;

    constructor(scope: Construct, id: string) {
        super(scope, id);
        
        this.orderTable = this.createOrderTable();
        this.paymentTable = this.createPaymentTable();
        this.productTable = this.createProductTable();
    }

    private createOrderTable(): ITable {
        return new Table(this, 'OrderTable', {
            partitionKey: { name: 'orderId', type: AttributeType.STRING },
            sortKey: { name: 'createdAt', type: AttributeType.STRING },
            tableName: 'Orders',
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY
        });
    }

    private createPaymentTable(): ITable {
        return new Table(this, 'PaymentTable', {
            partitionKey: { name: 'paymentId', type: AttributeType.STRING },
            tableName: 'Payments',
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY
        });
    }

    private createProductTable(): ITable {
        return new Table(this, 'ProductTable', {
            partitionKey: { name: 'productId', type: AttributeType.STRING },
            tableName: 'Products',
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY
        });
    }
}