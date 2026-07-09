import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
import { createHandler } from '../../shared/create-handler';
import { createStreamToEventBridgePipe } from '../../shared/create-stream-pipe';

export interface VideoServiceStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  table: ITable;
  tableStreamArn: string;
  rawUploadsBucket: s3.IBucket;
  transcodedBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
  eventBus: events.IEventBus;
  namespace: servicediscovery.HttpNamespace;
}

const EVENT_SOURCE = 'course-platform.video';

/**
 * Stateless resources for Video Upload & Transcode, including the Step Functions +
 * MediaConvert pipeline that modernizes the book's raw Lambda "transcode start/finish"
 * pair (Serverless Architectures on AWS, 2nd Ed., Fig 5.2).
 */
export class VideoServiceStack extends cdk.Stack {
  public readonly requestVideoUploadFn: NodejsFunction;
  public readonly getVideoFn: NodejsFunction;
  public readonly listVideosForCourseFn: NodejsFunction;
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: VideoServiceStackProps) {
    super(scope, id, props);

    const environment = {
      TABLE_NAME: props.table.tableName,
      RAW_BUCKET_NAME: props.rawUploadsBucket.bucketName,
      EVENT_BUS_NAME: props.eventBus.eventBusName,
      EVENT_SOURCE,
    };

    this.requestVideoUploadFn = createHandler(this, 'RequestVideoUploadFunction', {
      domain: 'video',
      name: 'requestVideoUpload',
      environment,
    });
    this.getVideoFn = createHandler(this, 'GetVideoFunction', {
      domain: 'video',
      name: 'getVideo',
      environment,
    });
    this.listVideosForCourseFn = createHandler(this, 'ListVideosForCourseFunction', {
      domain: 'video',
      name: 'listVideosForCourse',
      environment,
    });

    props.table.grantReadWriteData(this.requestVideoUploadFn);
    props.table.grantReadData(this.getVideoFn);
    props.table.grantReadData(this.listVideosForCourseFn);
    props.rawUploadsBucket.grantPut(this.requestVideoUploadFn);
    props.eventBus.grantPutEventsTo(this.requestVideoUploadFn);

    // -- MediaConvert transcoding pipeline --------------------------------------------

    const mediaConvertRole = new iam.Role(this, 'MediaConvertServiceRole', {
      assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
      description: 'Assumed by MediaConvert to read raw uploads and write transcoded output',
    });
    props.rawUploadsBucket.grantRead(mediaConvertRole);
    props.transcodedBucket.grantWrite(mediaConvertRole);

    const submitMediaConvertJobFn = createHandler(this, 'SubmitMediaConvertJobFunction', {
      domain: 'video',
      name: 'submitMediaConvertJob',
      timeout: cdk.Duration.seconds(60),
      environment: {
        MEDIACONVERT_ROLE_ARN: mediaConvertRole.roleArn,
        OUTPUT_BUCKET_NAME: props.transcodedBucket.bucketName,
      },
    });
    submitMediaConvertJobFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['mediaconvert:CreateJob', 'mediaconvert:DescribeEndpoints'],
        resources: ['*'],
      })
    );
    submitMediaConvertJobFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [mediaConvertRole.roleArn],
      })
    );

    const completeTranscodeJobFn = createHandler(this, 'CompleteTranscodeJobFunction', {
      domain: 'video',
      name: 'completeTranscodeJob',
      environment: {
        CLOUDFRONT_DOMAIN: props.distribution.distributionDomainName,
      },
    });

    const emitFailureEvent = new tasks.EventBridgePutEvents(this, 'EmitTranscodeFailedEventGeneric', {
      entries: [
        {
          eventBus: props.eventBus,
          source: EVENT_SOURCE,
          detailType: 'Video.TranscodeFailed',
          detail: sfn.TaskInput.fromObject({
            bucket: sfn.JsonPath.stringAt('$.detail.bucket.name'),
            key: sfn.JsonPath.stringAt('$.detail.object.key'),
            error: sfn.JsonPath.stringAt('$.error.Error'),
          }),
        },
      ],
    }).next(new sfn.Fail(this, 'TranscodeSubmissionFailed', { error: 'TranscodeSubmissionFailed' }));

    const submitJob = new tasks.LambdaInvoke(this, 'SubmitMediaConvertJob', {
      lambdaFunction: submitMediaConvertJobFn,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      payload: sfn.TaskInput.fromObject({
        taskToken: sfn.JsonPath.taskToken,
        bucket: sfn.JsonPath.stringAt('$.detail.bucket.name'),
        key: sfn.JsonPath.stringAt('$.detail.object.key'),
      }),
      resultPath: '$.transcodeResult',
      taskTimeout: sfn.Timeout.duration(cdk.Duration.hours(2)),
    }).addCatch(emitFailureEvent, { resultPath: '$.error' });

    const emitCompletedEvent = new tasks.EventBridgePutEvents(this, 'EmitTranscodeCompletedEvent', {
      entries: [
        {
          eventBus: props.eventBus,
          source: EVENT_SOURCE,
          detailType: 'Video.TranscodeCompleted',
          detail: sfn.TaskInput.fromObject({
            videoId: sfn.JsonPath.stringAt('$.transcodeResult.videoId'),
            cloudFrontUrl: sfn.JsonPath.stringAt('$.transcodeResult.cloudFrontUrl'),
          }),
        },
      ],
    });

    const updateVideoReady = new tasks.DynamoUpdateItem(this, 'UpdateVideoRecordReady', {
      table: props.table,
      key: {
        PK: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.transcodeResult.pk')),
        SK: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.transcodeResult.sk')),
      },
      updateExpression: 'SET #status = :status, cloudFrontUrl = :url, updatedAt = :now',
      expressionAttributeNames: { '#status': 'status' },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('READY'),
        ':url': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.transcodeResult.cloudFrontUrl')),
        ':now': tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$$.State.EnteredTime')),
      },
      resultPath: sfn.JsonPath.DISCARD,
    }).next(emitCompletedEvent);

    const emitFailedEvent = new tasks.EventBridgePutEvents(this, 'EmitTranscodeFailedEvent', {
      entries: [
        {
          eventBus: props.eventBus,
          source: EVENT_SOURCE,
          detailType: 'Video.TranscodeFailed',
          detail: sfn.TaskInput.fromObject({
            videoId: sfn.JsonPath.stringAt('$.transcodeResult.videoId'),
          }),
        },
      ],
    }).next(new sfn.Fail(this, 'TranscodeJobFailed', { error: 'TranscodeJobFailed' }));

    const updateVideoFailed = new tasks.DynamoUpdateItem(this, 'UpdateVideoRecordFailed', {
      table: props.table,
      key: {
        PK: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.transcodeResult.pk')),
        SK: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.transcodeResult.sk')),
      },
      updateExpression: 'SET #status = :status',
      expressionAttributeNames: { '#status': 'status' },
      expressionAttributeValues: {
        ':status': tasks.DynamoAttributeValue.fromString('FAILED'),
      },
      resultPath: sfn.JsonPath.DISCARD,
    }).next(emitFailedEvent);

    const statusChoice = new sfn.Choice(this, 'TranscodeStatusChoice')
      .when(sfn.Condition.stringEquals('$.transcodeResult.status', 'READY'), updateVideoReady)
      .otherwise(updateVideoFailed);

    const definition = submitJob.next(statusChoice);

    const logGroup = new logs.LogGroup(this, 'TranscodeStateMachineLogGroup', {
      logGroupName: `/course-platform/${props.envConfig.envName}/video-transcode`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.stateMachine = new sfn.StateMachine(this, 'VideoTranscodeStateMachine', {
      stateMachineName: `course-platform-${props.envConfig.envName}-video-transcode`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      logs: { destination: logGroup, level: sfn.LogLevel.ALL },
    });

    this.stateMachine.grantTaskResponse(completeTranscodeJobFn);

    // Trigger: raw bucket upload -> state machine (S3 -> EventBridge default bus -> rule)
    new events.Rule(this, 'RawUploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [props.rawUploadsBucket.bucketName] },
        },
      },
      targets: [new targets.SfnStateMachine(this.stateMachine)],
    });

    // MediaConvert reports job completion on the AWS default bus (AWS-service events never
    // land on a custom bus), so this rule lives on the account's default bus too.
    new events.Rule(this, 'MediaConvertJobStateChangeRule', {
      eventPattern: {
        source: ['aws.mediaconvert'],
        detailType: ['MediaConvert Job State Change'],
        detail: { status: ['COMPLETE', 'ERROR'] },
      },
      targets: [new targets.LambdaFunction(completeTranscodeJobFn)],
    });

    createStreamToEventBridgePipe(this, 'VideoStreamPipe', {
      tableStreamArn: props.tableStreamArn,
      eventBus: props.eventBus,
      source: EVENT_SOURCE,
      detailType: 'VideoDataChanged',
    });

    const cmService = props.namespace.createService('VideoRegistry', {
      name: 'video-upload-transcode',
      description: 'Video Upload & Transcode microservice',
    });
    cmService.registerNonIpInstance('Instance', {
      customAttributes: {
        STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
        CLOUDFRONT_DOMAIN: props.distribution.distributionDomainName,
      },
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'video');
  }
}
