import { CfnOutput } from "aws-cdk-lib";
import { JsonSchemaType, JsonSchemaVersion, LambdaIntegration, Model, RequestValidator, RestApi } from "aws-cdk-lib/aws-apigateway";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

interface RecipeFinderApiGatewayProps {
  createRecipeHandler: IFunction;
  findRecipeHandler: IFunction;
  docsHandler: IFunction;
}

export class RecipeFinderApiGateway extends Construct {
  constructor(scope: Construct, id: string, props: RecipeFinderApiGatewayProps) {
    super(scope, id);

    const api = new RestApi(this, 'RecipeFinderApi', {
      restApiName: 'Recipe Finder Service'
    });

    // Recipe endpoints
    const recipes = api.root.addResource('recipes');

    recipes.addMethod('POST', new LambdaIntegration(props.createRecipeHandler), {
      operationName: 'CreateRecipe',
      requestValidator: new RequestValidator(this, 'CreateRecipeValidator', {
        restApi: api,
        validateRequestBody: true
      }),
      requestModels: {
        'application/json': new Model(this, 'createRecipeModel', {
          restApi: api,
          contentType: 'application/json',
          schema: {
            schema: JsonSchemaVersion.DRAFT4,
            title: 'CreateRecipeRequest',
            type: JsonSchemaType.OBJECT,
            properties: {
              name: {
                type: JsonSchemaType.STRING,
                minLength: 1,
              },
              content: {
                type: JsonSchemaType.STRING,
                minLength: 1,
              }
            },
            required: ['name', 'content'],
            additionalProperties: false,
          }
        })
      }
    });

    const search = recipes.addResource('search');

    search.addMethod('POST', new LambdaIntegration(props.findRecipeHandler), {
      operationName: 'FindRecipe',
      requestValidator: new RequestValidator(this, 'FindRecipeValidator', {
        restApi: api,
        validateRequestBody: true
      }),
      requestModels: {
        'application/json': new Model(this, 'findRecipeModel', {
          restApi: api,
          contentType: 'application/json',
          schema: {
            schema: JsonSchemaVersion.DRAFT4,
            title: 'FindRecipeRequest',
            type: JsonSchemaType.OBJECT,
            properties: {
              query: {
                type: JsonSchemaType.STRING,
                minLength: 1,
              }
            },
            required: ['query'],
            additionalProperties: false,
          }
        })
      }
    });

    // Docs - Swagger UI + OpenAPI spec describing the routes above
    const docsHandlerIntegration = new LambdaIntegration(props.docsHandler);

    const docs = api.root.addResource('docs');
    docs.addMethod('GET', docsHandlerIntegration);

    const openapiSpec = docs.addResource('openapi.json');
    openapiSpec.addMethod('GET', docsHandlerIntegration);

    new CfnOutput(this, 'RecipeFinderApiEndpoint', {
      value: api.url,
      description: 'Recipe Finder API Endpoint'
    });
  }
}
