import { Duration, Stack } from "aws-cdk-lib";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { EventType, IBucket } from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";
import { join } from "path";

const GENERATION_MODEL_ID = 'anthropic.claude-sonnet-4-6';
const GENERATION_INFERENCE_PROFILE_ID = `us.${GENERATION_MODEL_ID}`;

interface RecipeFinderMicroservicesProps {
  documentsBucket: IBucket;
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  dataSourceId: string;
}

export class RecipeFinderMicroservices extends Construct {
  public readonly createRecipeHandler: NodejsFunction;
  public readonly ingestRecipeHandler: NodejsFunction;
  public readonly findRecipeHandler: NodejsFunction;
  public readonly docsHandler: NodejsFunction;
  public readonly generationModelArn: string;

  constructor(scope: Construct, id: string, props: RecipeFinderMicroservicesProps) {
    super(scope, id);

    const { region, account } = Stack.of(this);
    // Most accounts have no on-demand throughput for Claude 3.5 Sonnet outside its home
    // region, so this stack invokes it through the US cross-region inference profile instead.
    this.generationModelArn = `arn:aws:bedrock:${region}:${account}:inference-profile/${GENERATION_INFERENCE_PROFILE_ID}`;

    this.createRecipeHandler = this.createCreateRecipeLambda(props.documentsBucket);
    this.ingestRecipeHandler = this.createIngestRecipeLambda(props.knowledgeBaseId, props.dataSourceId, props.knowledgeBaseArn);
    this.findRecipeHandler = this.createFindRecipeLambda(props.knowledgeBaseId, props.knowledgeBaseArn);
    this.docsHandler = this.createDocsHandlerLambda();

    // New recipe documents land in the bucket and automatically kick off a Knowledge Base
    // ingestion job, rather than requiring a manual console sync.
    props.documentsBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.ingestRecipeHandler),
      { prefix: 'recipes/' }
    );
  }

  private createCreateRecipeLambda(documentsBucket: IBucket): NodejsFunction {
    const fn = new NodejsFunction(this, 'createRecipe', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/recipe/createRecipe/index.js"),
      environment: {
        DOCUMENTS_BUCKET_NAME: documentsBucket.bucketName
      },
      timeout: Duration.seconds(30)
    });

    documentsBucket.grantWrite(fn);
    return fn;
  }

  private createIngestRecipeLambda(knowledgeBaseId: string, dataSourceId: string, knowledgeBaseArn: string): NodejsFunction {
    const fn = new NodejsFunction(this, 'ingestRecipe', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/recipe/ingestRecipe/index.js"),
      environment: {
        KNOWLEDGE_BASE_ID: knowledgeBaseId,
        DATA_SOURCE_ID: dataSourceId
      },
      timeout: Duration.seconds(30)
    });

    fn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:StartIngestionJob'],
      resources: [knowledgeBaseArn]
    }));

    return fn;
  }

  private createFindRecipeLambda(knowledgeBaseId: string, knowledgeBaseArn: string): NodejsFunction {
    const fn = new NodejsFunction(this, 'findRecipe', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/recipe/findRecipe/index.js"),
      environment: {
        KNOWLEDGE_BASE_ID: knowledgeBaseId,
        GENERATION_MODEL_ARN: this.generationModelArn
      },
      timeout: Duration.seconds(30)
    });

    fn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:RetrieveAndGenerate', 'bedrock:Retrieve'],
      resources: [knowledgeBaseArn]
    }));

    fn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:*::foundation-model/${GENERATION_MODEL_ID}`,
        this.generationModelArn
      ]
    }));

    // RetrieveAndGenerate resolves the cross-region inference profile before invoking the
    // underlying model, which requires this separate permission on the profile itself.
    fn.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['bedrock:GetInferenceProfile'],
      resources: [this.generationModelArn]
    }));

    return fn;
  }

  private createDocsHandlerLambda(): NodejsFunction {
    return new NodejsFunction(this, 'docs', {
      runtime: Runtime.NODEJS_20_X,
      entry: join(__dirname, "../src/docs/index.js"),
      timeout: Duration.seconds(10)
    });
  }
}
