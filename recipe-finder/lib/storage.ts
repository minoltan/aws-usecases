import { RemovalPolicy } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { CfnIndex, CfnVectorBucket } from "aws-cdk-lib/aws-s3vectors";
import { Construct } from "constructs";

export class RecipeFinderStorage extends Construct {
  public readonly documentsBucket: IBucket;
  public readonly vectorBucket: CfnVectorBucket;
  public readonly vectorIndex: CfnIndex;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.documentsBucket = this.createDocumentsBucket();
    this.vectorBucket = this.createVectorBucket();
    this.vectorIndex = this.createVectorIndex(this.vectorBucket);
  }

  private createDocumentsBucket(): IBucket {
    return new Bucket(this, 'RecipeDocumentsBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
  }

  private createVectorBucket(): CfnVectorBucket {
    const vectorBucket = new CfnVectorBucket(this, 'RecipeVectorBucket', {
      vectorBucketName: 'recipe-finder-vectors'
    });

    // S3 Vectors only allows deleting empty buckets, so cdk destroy can still fail here -
    // see README "Known Limitations" for the manual cleanup step.
    vectorBucket.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return vectorBucket;
  }

  private createVectorIndex(vectorBucket: CfnVectorBucket): CfnIndex {
    const vectorIndex = new CfnIndex(this, 'RecipeVectorIndex', {
      indexName: 'recipe-finder-index',
      vectorBucketArn: vectorBucket.attrVectorBucketArn,
      dataType: 'float32',
      // Titan Text Embeddings v2 produces 1024-dimensional vectors by default.
      dimension: 1024,
      distanceMetric: 'cosine'
    });

    vectorIndex.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return vectorIndex;
  }
}
