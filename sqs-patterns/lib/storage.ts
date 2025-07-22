// lib/storage.ts
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { 
  Bucket, 
  BucketAccessControl, 
  BlockPublicAccess,
  HttpMethods 
} from 'aws-cdk-lib/aws-s3';

export interface EcommerceStorageProps {
  bucketName?: string;
}

export class EcommerceStorage extends Construct {
  public readonly uploadBucket: Bucket;

  constructor(scope: Construct, id: string, props?: EcommerceStorageProps) {
    super(scope, id);

    // Create the upload bucket for images
    this.uploadBucket = new Bucket(this, 'UploadBucket', {
      bucketName: props?.bucketName,
      removalPolicy: RemovalPolicy.RETAIN,
      accessControl: BucketAccessControl.PRIVATE,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      // Enable CORS for direct browser uploads
      cors: [
        {
          allowedMethods: [
            HttpMethods.PUT, 
            HttpMethods.POST
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag']
        }
      ]
    });
  }
}