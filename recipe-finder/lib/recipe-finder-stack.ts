import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RecipeFinderApiGateway } from './apigateway';
import { RecipeKnowledgeBase } from './knowledgebase';
import { RecipeFinderMicroservices } from './microservices';
import { RecipeFinderStorage } from './storage';

export class RecipeFinderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Storage: raw recipe documents bucket + S3 Vector bucket/index for the embeddings
    const storage = new RecipeFinderStorage(this, 'RecipeFinderStorage');

    // Bedrock Knowledge Base backed by S3 Vectors, with an S3 data source over the recipes
    const knowledgeBase = new RecipeKnowledgeBase(this, 'RecipeKnowledgeBase', {
      documentsBucket: storage.documentsBucket,
      vectorBucket: storage.vectorBucket,
      vectorIndex: storage.vectorIndex
    });

    // Lambdas
    const microservices = new RecipeFinderMicroservices(this, 'RecipeFinderMicroservices', {
      documentsBucket: storage.documentsBucket,
      knowledgeBaseId: knowledgeBase.knowledgeBaseId,
      knowledgeBaseArn: knowledgeBase.knowledgeBaseArn,
      dataSourceId: knowledgeBase.dataSourceId
    });

    // API Gateway
    new RecipeFinderApiGateway(this, 'RecipeFinderApiGateway', {
      createRecipeHandler: microservices.createRecipeHandler,
      findRecipeHandler: microservices.findRecipeHandler,
      docsHandler: microservices.docsHandler
    });
  }
}
