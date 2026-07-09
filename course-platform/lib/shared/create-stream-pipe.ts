import * as iam from 'aws-cdk-lib/aws-iam';
import { CfnPipe } from 'aws-cdk-lib/aws-pipes';
import { IEventBus } from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

export interface StreamPipeProps {
  /** DynamoDB table stream ARN to read from. */
  tableStreamArn: string;
  eventBus: IEventBus;
  /** EventBridge `source` to stamp on emitted events, e.g. 'course-platform.course-catalog'. */
  source: string;
  /** EventBridge `detail-type` to stamp on emitted events, e.g. 'CourseCatalogDataChanged'. */
  detailType: string;
}

/**
 * DynamoDB Streams -> EventBridge Pipe (no Lambda glue), reshaping change records straight
 * onto the shared bus. This is the modern replacement for the book's "DynamoDB Streams +
 * Lambda kept a materialized Firebase view in sync" pattern (Serverless Architectures on
 * AWS, 2nd Ed., section 5.2) -- it's what lets the analytics microservice observe every
 * other microservice's data changes without a hard dependency.
 */
export function createStreamToEventBridgePipe(scope: Construct, id: string, props: StreamPipeProps): CfnPipe {
  const role = new iam.Role(scope, `${id}Role`, {
    assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
  });
  role.addToPolicy(
    new iam.PolicyStatement({
      actions: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator', 'dynamodb:ListStreams'],
      resources: [props.tableStreamArn],
    })
  );
  props.eventBus.grantPutEventsTo(role);

  return new CfnPipe(scope, id, {
    name: id,
    roleArn: role.roleArn,
    source: props.tableStreamArn,
    sourceParameters: {
      dynamoDbStreamParameters: { startingPosition: 'LATEST', batchSize: 10 },
    },
    target: props.eventBus.eventBusArn,
    targetParameters: {
      eventBridgeEventBusParameters: {
        detailType: props.detailType,
        source: props.source,
      },
      inputTemplate:
        '{"eventName": <$.eventName>, "keys": <$.dynamodb.Keys>, "newImage": <$.dynamodb.NewImage>, "oldImage": <$.dynamodb.OldImage>}',
    },
  });
}
