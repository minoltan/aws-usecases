import { Duration } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

export interface HandlerProps extends Partial<NodejsFunctionProps> {
  /** Microservice domain folder under src/handlers/, e.g. 'course-catalog'. */
  domain: string;
  /** Handler folder name under src/handlers/<domain>/, e.g. 'createCourse'. */
  name: string;
}

/**
 * Wraps NodejsFunction with this repo's plain-ESM-JS handler convention:
 * src/handlers/<domain>/<name>/index.js, each with its own package.json.
 */
export function createHandler(scope: Construct, id: string, props: HandlerProps): NodejsFunction {
  const { domain, name, environment, ...overrides } = props;
  return new NodejsFunction(scope, id, {
    runtime: Runtime.NODEJS_22_X,
    entry: join(__dirname, '../../src/handlers', domain, name, 'index.js'),
    timeout: Duration.seconds(30),
    memorySize: 256,
    bundling: {
      minify: true,
      sourceMap: true,
      format: OutputFormat.ESM,
      banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
      externalModules: [],
    },
    ...overrides,
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      ...environment,
    },
  });
}
