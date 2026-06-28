import { Stack } from "aws-cdk-lib";
import { CfnDataSource, CfnKnowledgeBase } from "aws-cdk-lib/aws-bedrock";
import { Effect, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { CfnIndex, CfnVectorBucket } from "aws-cdk-lib/aws-s3vectors";
import { Construct } from "constructs";

export const EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0';

interface RecipeKnowledgeBaseProps {
  documentsBucket: IBucket;
  vectorBucket: CfnVectorBucket;
  vectorIndex: CfnIndex;
}

export class RecipeKnowledgeBase extends Construct {
  public readonly knowledgeBaseId: string;
  public readonly knowledgeBaseArn: string;
  public readonly dataSourceId: string;

  constructor(scope: Construct, id: string, props: RecipeKnowledgeBaseProps) {
    super(scope, id);

    const role = this.createKnowledgeBaseRole(props.documentsBucket, props.vectorBucket, props.vectorIndex);
    const knowledgeBase = this.createKnowledgeBase(role, props.vectorBucket, props.vectorIndex);
    // The KB only references role.roleArn, which makes CloudFormation wait for the Role
    // resource but not for the separate DefaultPolicy resource carrying the s3vectors/bedrock
    // grants - without this, Bedrock can validate storage config before that policy attaches.
    knowledgeBase.node.addDependency(role);
    const dataSource = this.createDataSource(knowledgeBase, props.documentsBucket);

    this.knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;
    this.knowledgeBaseArn = knowledgeBase.attrKnowledgeBaseArn;
    this.dataSourceId = dataSource.attrDataSourceId;
  }

  private createKnowledgeBaseRole(documentsBucket: IBucket, vectorBucket: CfnVectorBucket, vectorIndex: CfnIndex): Role {
    const { region, account } = Stack.of(this);

    const role = new Role(this, 'RecipeKnowledgeBaseRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': account },
          ArnLike: { 'aws:SourceArn': `arn:aws:bedrock:${region}:${account}:knowledge-base/*` }
        }
      })
    });

    role.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [`arn:aws:bedrock:${region}::foundation-model/${EMBEDDING_MODEL_ID}`]
    }));

    documentsBucket.grantRead(role);

    role.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3vectors:GetVectorBucket',
        's3vectors:GetIndex',
        's3vectors:PutVectors',
        's3vectors:GetVectors',
        's3vectors:ListVectors',
        's3vectors:DeleteVectors',
        's3vectors:QueryVectors'
      ],
      resources: [vectorBucket.attrVectorBucketArn, vectorIndex.attrIndexArn]
    }));

    return role;
  }

  private createKnowledgeBase(role: Role, vectorBucket: CfnVectorBucket, vectorIndex: CfnIndex): CfnKnowledgeBase {
    const { region } = Stack.of(this);

    return new CfnKnowledgeBase(this, 'RecipeKnowledgeBase', {
      name: 'recipe-finder-kb',
      roleArn: role.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${region}::foundation-model/${EMBEDDING_MODEL_ID}`
        }
      },
      storageConfiguration: {
        type: 'S3_VECTORS',
        s3VectorsConfiguration: {
          vectorBucketArn: vectorBucket.attrVectorBucketArn,
          indexArn: vectorIndex.attrIndexArn
        }
      }
    });
  }

  private createDataSource(knowledgeBase: CfnKnowledgeBase, documentsBucket: IBucket): CfnDataSource {
    return new CfnDataSource(this, 'RecipeDataSource', {
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      name: 'recipe-finder-docs',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: documentsBucket.bucketArn,
          inclusionPrefixes: ['recipes/']
        }
      }
    });
  }
}
