import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
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
export declare function createHandler(scope: Construct, id: string, props: HandlerProps): NodejsFunction;
