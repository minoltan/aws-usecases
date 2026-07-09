import { Duration, Expiration } from 'aws-cdk-lib';
import {
  AuthorizationType,
  Code,
  Definition,
  FieldLogLevel,
  FunctionRuntime,
  GraphqlApi,
} from 'aws-cdk-lib/aws-appsync';
import { Construct } from 'constructs';
import { join } from 'path';

export class ExamPlatformAppSync extends Construct {
  public readonly api: GraphqlApi;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.api = new GraphqlApi(this, 'ExamPlatformGraphQL', {
      name: 'ExamPlatformGraphQL',
      definition: Definition.fromFile(join(__dirname, 'appsync/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: Expiration.after(Duration.days(365)),
            description: 'Exam Platform API Key',
          },
        },
      },
      xrayEnabled: true,
      logConfig: {
        fieldLogLevel: FieldLogLevel.ALL,
      },
    });

    // None data source for subscription passthrough
    const noneDataSource = this.api.addNoneDataSource('NoneDataSource', {
      name: 'NoneDataSource',
      description: 'Passthrough for subscription mutations',
    });

    noneDataSource.createResolver('PublishExamResultResolver', {
      typeName: 'Mutation',
      fieldName: 'publishExamResult',
      runtime: FunctionRuntime.JS_1_0_0,
      code: Code.fromAsset(join(__dirname, 'appsync/resolvers/publish-exam-result.js')),
    });
  }
}
