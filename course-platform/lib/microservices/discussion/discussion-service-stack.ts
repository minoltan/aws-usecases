import * as cdk from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
import { createHandler } from '../../shared/create-handler';
import { createStreamToEventBridgePipe } from '../../shared/create-stream-pipe';

export interface DiscussionServiceStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  table: ITable;
  tableStreamArn: string;
  eventBus: events.IEventBus;
  namespace: servicediscovery.HttpNamespace;
}

const EVENT_SOURCE = 'course-platform.discussion';

/**
 * Real-time forum -- the direct modern replacement for the book's Firebase-websocket
 * discussion forum (Serverless Architectures on AWS, 2nd Ed., 5.1). `postMessage` is
 * annotated `@aws_subscribe` in the AppSync schema, so posting *is* the thing clients
 * subscribe to; no separate "None" passthrough resolver is needed.
 */
export class DiscussionServiceStack extends cdk.Stack {
  public readonly createThreadFn: NodejsFunction;
  public readonly postMessageFn: NodejsFunction;
  public readonly listMessagesFn: NodejsFunction;
  public readonly listThreadsFn: NodejsFunction;

  constructor(scope: Construct, id: string, props: DiscussionServiceStackProps) {
    super(scope, id, props);

    const environment = {
      TABLE_NAME: props.table.tableName,
      EVENT_BUS_NAME: props.eventBus.eventBusName,
      EVENT_SOURCE,
    };

    this.createThreadFn = createHandler(this, 'CreateThreadFunction', {
      domain: 'discussion',
      name: 'createThread',
      environment,
    });
    this.postMessageFn = createHandler(this, 'PostMessageFunction', {
      domain: 'discussion',
      name: 'postMessage',
      environment,
    });
    this.listMessagesFn = createHandler(this, 'ListMessagesFunction', {
      domain: 'discussion',
      name: 'listMessages',
      environment,
    });
    this.listThreadsFn = createHandler(this, 'ListThreadsFunction', {
      domain: 'discussion',
      name: 'listThreads',
      environment,
    });

    props.table.grantReadWriteData(this.createThreadFn);
    props.table.grantReadWriteData(this.postMessageFn);
    props.table.grantReadData(this.listMessagesFn);
    props.table.grantReadData(this.listThreadsFn);

    props.eventBus.grantPutEventsTo(this.createThreadFn);
    props.eventBus.grantPutEventsTo(this.postMessageFn);

    createStreamToEventBridgePipe(this, 'DiscussionStreamPipe', {
      tableStreamArn: props.tableStreamArn,
      eventBus: props.eventBus,
      source: EVENT_SOURCE,
      detailType: 'DiscussionDataChanged',
    });

    const cmService = props.namespace.createService('DiscussionRegistry', {
      name: 'discussion-forum',
      description: 'Discussion Forum microservice',
    });
    cmService.registerNonIpInstance('Instance', {
      customAttributes: {
        LAMBDA_ENTRYPOINT_ARN: this.listThreadsFn.functionArn,
        SCHEMA_VERSION: '1.0',
      },
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'discussion');
  }
}
