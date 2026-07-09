"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoServiceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
const create_handler_1 = require("../../shared/create-handler");
const create_stream_pipe_1 = require("../../shared/create-stream-pipe");
const EVENT_SOURCE = 'course-platform.video';
/**
 * Stateless resources for Video Upload & Transcode, including the Step Functions +
 * MediaConvert pipeline that modernizes the book's raw Lambda "transcode start/finish"
 * pair (Serverless Architectures on AWS, 2nd Ed., Fig 5.2).
 */
class VideoServiceStack extends cdk.Stack {
    requestVideoUploadFn;
    getVideoFn;
    listVideosForCourseFn;
    stateMachine;
    constructor(scope, id, props) {
        super(scope, id, props);
        const environment = {
            TABLE_NAME: props.table.tableName,
            RAW_BUCKET_NAME: props.rawUploadsBucket.bucketName,
            EVENT_BUS_NAME: props.eventBus.eventBusName,
            EVENT_SOURCE,
        };
        this.requestVideoUploadFn = (0, create_handler_1.createHandler)(this, 'RequestVideoUploadFunction', {
            domain: 'video',
            name: 'requestVideoUpload',
            environment,
        });
        this.getVideoFn = (0, create_handler_1.createHandler)(this, 'GetVideoFunction', {
            domain: 'video',
            name: 'getVideo',
            environment,
        });
        this.listVideosForCourseFn = (0, create_handler_1.createHandler)(this, 'ListVideosForCourseFunction', {
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
        const submitMediaConvertJobFn = (0, create_handler_1.createHandler)(this, 'SubmitMediaConvertJobFunction', {
            domain: 'video',
            name: 'submitMediaConvertJob',
            timeout: cdk.Duration.seconds(60),
            environment: {
                MEDIACONVERT_ROLE_ARN: mediaConvertRole.roleArn,
                OUTPUT_BUCKET_NAME: props.transcodedBucket.bucketName,
            },
        });
        submitMediaConvertJobFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['mediaconvert:CreateJob', 'mediaconvert:DescribeEndpoints'],
            resources: ['*'],
        }));
        submitMediaConvertJobFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['iam:PassRole'],
            resources: [mediaConvertRole.roleArn],
        }));
        const completeTranscodeJobFn = (0, create_handler_1.createHandler)(this, 'CompleteTranscodeJobFunction', {
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
        (0, create_stream_pipe_1.createStreamToEventBridgePipe)(this, 'VideoStreamPipe', {
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
exports.VideoServiceStack = VideoServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlkZW8tc2VydmljZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpZGVvLXNlcnZpY2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBR25DLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQseURBQTJDO0FBRTNDLDJEQUE2QztBQUc3QyxtRUFBcUQ7QUFDckQsMkVBQTZEO0FBRzdELGdFQUE0RDtBQUM1RCx3RUFBZ0Y7QUFhaEYsTUFBTSxZQUFZLEdBQUcsdUJBQXVCLENBQUM7QUFFN0M7Ozs7R0FJRztBQUNILE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDOUIsb0JBQW9CLENBQWlCO0lBQ3JDLFVBQVUsQ0FBaUI7SUFDM0IscUJBQXFCLENBQWlCO0lBQ3RDLFlBQVksQ0FBbUI7SUFFL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE2QjtRQUNyRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFdBQVcsR0FBRztZQUNsQixVQUFVLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTO1lBQ2pDLGVBQWUsRUFBRSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUNsRCxjQUFjLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxZQUFZO1lBQzNDLFlBQVk7U0FDYixDQUFDO1FBRUYsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUEsOEJBQWEsRUFBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUU7WUFDNUUsTUFBTSxFQUFFLE9BQU87WUFDZixJQUFJLEVBQUUsb0JBQW9CO1lBQzFCLFdBQVc7U0FDWixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUEsOEJBQWEsRUFBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDeEQsTUFBTSxFQUFFLE9B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LE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFBRTtZQUMvRCxJQUFJLEVBQUUsd0JBQXdCO1lBQzlCLFdBQVcsRUFBRSx1Q0FBdUM7U0FDckQsQ0FBQyxDQUFDO1FBQ0gsU0FBUyxDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRTtZQUMxQyxnQkFBZ0IsRUFBRTtnQkFDaEIsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlO2dCQUNwRCxpQkFBaUIsRUFBRSxLQUFLLENBQUMsWUFBWSxDQUFDLHNCQUFzQjthQUM3RDtTQUNGLENBQUMsQ0FBQztRQUVILEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUNwRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNqRCxDQUFDO0NBQ0Y7QUFsT0QsOENBa09DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0IHsgSVRhYmxlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgc2VydmljZWRpc2NvdmVyeSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VydmljZWRpc2NvdmVyeSc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudCc7XG5pbXBvcnQgeyBjcmVhdGVIYW5kbGVyIH0gZnJvbSAnLi4vLi4vc2hhcmVkL2NyZWF0ZS1oYW5kbGVyJztcbmltcG9ydCB7IGNyZWF0ZVN0cmVhbVRvRXZlbnRCcmlkZ2VQaXBlIH0gZnJvbSAnLi4vLi4vc2hhcmVkL2NyZWF0ZS1zdHJlYW0tcGlwZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlkZW9TZXJ2aWNlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52Q29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgdGFibGU6IElUYWJsZTtcbiAgdGFibGVTdHJlYW1Bcm46IHN0cmluZztcbiAgcmF3VXBsb2Fkc0J1Y2tldDogczMuSUJ1Y2tldDtcbiAgdHJhbnNjb2RlZEJ1Y2tldDogczMuSUJ1Y2tldDtcbiAgZGlzdHJpYnV0aW9uOiBjbG91ZGZyb250LklEaXN0cmlidXRpb247XG4gIGV2ZW50QnVzOiBldmVudHMuSUV2ZW50QnVzO1xuICBuYW1lc3BhY2U6IHNlcnZpY2VkaXNjb3ZlcnkuSHR0cE5hbWVzcGFjZTtcbn1cblxuY29uc3QgRVZFTlRfU09VUkNFID0gJ2NvdXJzZS1wbGF0Zm9ybS52aWRlbyc7XG5cbi8qKlxuICogU3RhdGVsZXNzIHJlc291cmNlcyBmb3IgVmlkZW8gVXBsb2FkICYgVHJhbnNjb2RlLCBpbmNsdWRpbmcgdGhlIFN0ZXAgRnVuY3Rpb25zICtcbiAqIE1lZGlhQ29udmVydCBwaXBlbGluZSB0aGF0IG1vZGVybml6ZXMgdGhlIGJvb2sncyByYXcgTGFtYmRhIFwidHJhbnNjb2RlIHN0YXJ0L2ZpbmlzaFwiXG4gKiBwYWlyIChTZXJ2ZXJsZXNzIEFyY2hpdGVjdHVyZXMgb24gQVdTLCAybmQgRWQuLCBGaWcgNS4yKS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZpZGVvU2VydmljZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHJlcXVlc3RWaWRlb1VwbG9hZEZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGdldFZpZGVvRm46IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgbGlzdFZpZGVvc0ZvckNvdXJzZUZuOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0YXRlTWFjaGluZTogc2ZuLlN0YXRlTWFjaGluZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmlkZW9TZXJ2aWNlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSB7XG4gICAgICBUQUJMRV9OQU1FOiBwcm9wcy50YWJsZS50YWJsZU5hbWUsXG4gICAgICBSQVdfQlVDS0VUX05BTUU6IHByb3BzLnJhd1VwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIEVWRU5UX0JVU19OQU1FOiBwcm9wcy5ldmVudEJ1cy5ldmVudEJ1c05hbWUsXG4gICAgICBFVkVOVF9TT1VSQ0UsXG4gICAgfTtcblxuICAgIHRoaXMucmVxdWVzdFZpZGVvVXBsb2FkRm4gPSBjcmVhdGVIYW5kbGVyKHRoaXMsICdSZXF1ZXN0VmlkZW9VcGxvYWRGdW5jdGlvbicsIHtcbiAgICAgIGRvbWFpbjogJ3ZpZGVvJyxcbiAgICAgIG5hbWU6ICdyZXF1ZXN0VmlkZW9VcGxvYWQnLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgfSk7XG4gICAgdGhpcy5nZXRWaWRlb0ZuID0gY3JlYXRlSGFuZGxlcih0aGlzLCAnR2V0VmlkZW9GdW5jdGlvbicsIHtcbiAgICAgIGRvbWFpbjogJ3ZpZGVvJyxcbiAgICAgIG5hbWU6ICdnZXRWaWRlbycsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICB9KTtcbiAgICB0aGlzLmxpc3RWaWRlb3NGb3JDb3Vyc2VGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ0xpc3RWaWRlb3NGb3JDb3Vyc2VGdW5jdGlvbicsIHtcbiAgICAgIGRvbWFpbjogJ3ZpZGVvJyxcbiAgICAgIG5hbWU6ICdsaXN0VmlkZW9zRm9yQ291cnNlJyxcbiAgICAgIGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgcHJvcHMudGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMucmVxdWVzdFZpZGVvVXBsb2FkRm4pO1xuICAgIHByb3BzLnRhYmxlLmdyYW50UmVhZERhdGEodGhpcy5nZXRWaWRlb0ZuKTtcbiAgICBwcm9wcy50YWJsZS5ncmFudFJlYWREYXRhKHRoaXMubGlzdFZpZGVvc0ZvckNvdXJzZUZuKTtcbiAgICBwcm9wcy5yYXdVcGxvYWRzQnVja2V0LmdyYW50UHV0KHRoaXMucmVxdWVzdFZpZGVvVXBsb2FkRm4pO1xuICAgIHByb3BzLmV2ZW50QnVzLmdyYW50UHV0RXZlbnRzVG8odGhpcy5yZXF1ZXN0VmlkZW9VcGxvYWRGbik7XG5cbiAgICAvLyAtLSBNZWRpYUNvbnZlcnQgdHJhbnNjb2RpbmcgcGlwZWxpbmUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIGNvbnN0IG1lZGlhQ29udmVydFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ01lZGlhQ29udmVydFNlcnZpY2VSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ21lZGlhY29udmVydC5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0Fzc3VtZWQgYnkgTWVkaWFDb252ZXJ0IHRvIHJlYWQgcmF3IHVwbG9hZHMgYW5kIHdyaXRlIHRyYW5zY29kZWQgb3V0cHV0JyxcbiAgICB9KTtcbiAgICBwcm9wcy5yYXdVcGxvYWRzQnVja2V0LmdyYW50UmVhZChtZWRpYUNvbnZlcnRSb2xlKTtcbiAgICBwcm9wcy50cmFuc2NvZGVkQnVja2V0LmdyYW50V3JpdGUobWVkaWFDb252ZXJ0Um9sZSk7XG5cbiAgICBjb25zdCBzdWJtaXRNZWRpYUNvbnZlcnRKb2JGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ1N1Ym1pdE1lZGlhQ29udmVydEpvYkZ1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAndmlkZW8nLFxuICAgICAgbmFtZTogJ3N1Ym1pdE1lZGlhQ29udmVydEpvYicsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBNRURJQUNPTlZFUlRfUk9MRV9BUk46IG1lZGlhQ29udmVydFJvbGUucm9sZUFybixcbiAgICAgICAgT1VUUFVUX0JVQ0tFVF9OQU1FOiBwcm9wcy50cmFuc2NvZGVkQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHN1Ym1pdE1lZGlhQ29udmVydEpvYkZuLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydtZWRpYWNvbnZlcnQ6Q3JlYXRlSm9iJywgJ21lZGlhY29udmVydDpEZXNjcmliZUVuZHBvaW50cyddLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuICAgIHN1Ym1pdE1lZGlhQ29udmVydEpvYkZuLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydpYW06UGFzc1JvbGUnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbbWVkaWFDb252ZXJ0Um9sZS5yb2xlQXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGNvbnN0IGNvbXBsZXRlVHJhbnNjb2RlSm9iRm4gPSBjcmVhdGVIYW5kbGVyKHRoaXMsICdDb21wbGV0ZVRyYW5zY29kZUpvYkZ1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAndmlkZW8nLFxuICAgICAgbmFtZTogJ2NvbXBsZXRlVHJhbnNjb2RlSm9iJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIENMT1VERlJPTlRfRE9NQUlOOiBwcm9wcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBlbWl0RmFpbHVyZUV2ZW50ID0gbmV3IHRhc2tzLkV2ZW50QnJpZGdlUHV0RXZlbnRzKHRoaXMsICdFbWl0VHJhbnNjb2RlRmFpbGVkRXZlbnRHZW5lcmljJywge1xuICAgICAgZW50cmllczogW1xuICAgICAgICB7XG4gICAgICAgICAgZXZlbnRCdXM6IHByb3BzLmV2ZW50QnVzLFxuICAgICAgICAgIHNvdXJjZTogRVZFTlRfU09VUkNFLFxuICAgICAgICAgIGRldGFpbFR5cGU6ICdWaWRlby5UcmFuc2NvZGVGYWlsZWQnLFxuICAgICAgICAgIGRldGFpbDogc2ZuLlRhc2tJbnB1dC5mcm9tT2JqZWN0KHtcbiAgICAgICAgICAgIGJ1Y2tldDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmRldGFpbC5idWNrZXQubmFtZScpLFxuICAgICAgICAgICAga2V5OiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuZGV0YWlsLm9iamVjdC5rZXknKSxcbiAgICAgICAgICAgIGVycm9yOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQuZXJyb3IuRXJyb3InKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSkubmV4dChuZXcgc2ZuLkZhaWwodGhpcywgJ1RyYW5zY29kZVN1Ym1pc3Npb25GYWlsZWQnLCB7IGVycm9yOiAnVHJhbnNjb2RlU3VibWlzc2lvbkZhaWxlZCcgfSkpO1xuXG4gICAgY29uc3Qgc3VibWl0Sm9iID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnU3VibWl0TWVkaWFDb252ZXJ0Sm9iJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IHN1Ym1pdE1lZGlhQ29udmVydEpvYkZuLFxuICAgICAgaW50ZWdyYXRpb25QYXR0ZXJuOiBzZm4uSW50ZWdyYXRpb25QYXR0ZXJuLldBSVRfRk9SX1RBU0tfVE9LRU4sXG4gICAgICBwYXlsb2FkOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICB0YXNrVG9rZW46IHNmbi5Kc29uUGF0aC50YXNrVG9rZW4sXG4gICAgICAgIGJ1Y2tldDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLmRldGFpbC5idWNrZXQubmFtZScpLFxuICAgICAgICBrZXk6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC5kZXRhaWwub2JqZWN0LmtleScpLFxuICAgICAgfSksXG4gICAgICByZXN1bHRQYXRoOiAnJC50cmFuc2NvZGVSZXN1bHQnLFxuICAgICAgdGFza1RpbWVvdXQ6IHNmbi5UaW1lb3V0LmR1cmF0aW9uKGNkay5EdXJhdGlvbi5ob3VycygyKSksXG4gICAgfSkuYWRkQ2F0Y2goZW1pdEZhaWx1cmVFdmVudCwgeyByZXN1bHRQYXRoOiAnJC5lcnJvcicgfSk7XG5cbiAgICBjb25zdCBlbWl0Q29tcGxldGVkRXZlbnQgPSBuZXcgdGFza3MuRXZlbnRCcmlkZ2VQdXRFdmVudHModGhpcywgJ0VtaXRUcmFuc2NvZGVDb21wbGV0ZWRFdmVudCcsIHtcbiAgICAgIGVudHJpZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGV2ZW50QnVzOiBwcm9wcy5ldmVudEJ1cyxcbiAgICAgICAgICBzb3VyY2U6IEVWRU5UX1NPVVJDRSxcbiAgICAgICAgICBkZXRhaWxUeXBlOiAnVmlkZW8uVHJhbnNjb2RlQ29tcGxldGVkJyxcbiAgICAgICAgICBkZXRhaWw6IHNmbi5UYXNrSW5wdXQuZnJvbU9iamVjdCh7XG4gICAgICAgICAgICB2aWRlb0lkOiBzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQudHJhbnNjb2RlUmVzdWx0LnZpZGVvSWQnKSxcbiAgICAgICAgICAgIGNsb3VkRnJvbnRVcmw6IHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC50cmFuc2NvZGVSZXN1bHQuY2xvdWRGcm9udFVybCcpLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwZGF0ZVZpZGVvUmVhZHkgPSBuZXcgdGFza3MuRHluYW1vVXBkYXRlSXRlbSh0aGlzLCAnVXBkYXRlVmlkZW9SZWNvcmRSZWFkeScsIHtcbiAgICAgIHRhYmxlOiBwcm9wcy50YWJsZSxcbiAgICAgIGtleToge1xuICAgICAgICBQSzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQudHJhbnNjb2RlUmVzdWx0LnBrJykpLFxuICAgICAgICBTSzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQudHJhbnNjb2RlUmVzdWx0LnNrJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMsIGNsb3VkRnJvbnRVcmwgPSA6dXJsLCB1cGRhdGVkQXQgPSA6bm93JyxcbiAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczogeyAnI3N0YXR1cyc6ICdzdGF0dXMnIH0sXG4gICAgICBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6c3RhdHVzJzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZygnUkVBRFknKSxcbiAgICAgICAgJzp1cmwnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJC50cmFuc2NvZGVSZXN1bHQuY2xvdWRGcm9udFVybCcpKSxcbiAgICAgICAgJzpub3cnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKHNmbi5Kc29uUGF0aC5zdHJpbmdBdCgnJCQuU3RhdGUuRW50ZXJlZFRpbWUnKSksXG4gICAgICB9LFxuICAgICAgcmVzdWx0UGF0aDogc2ZuLkpzb25QYXRoLkRJU0NBUkQsXG4gICAgfSkubmV4dChlbWl0Q29tcGxldGVkRXZlbnQpO1xuXG4gICAgY29uc3QgZW1pdEZhaWxlZEV2ZW50ID0gbmV3IHRhc2tzLkV2ZW50QnJpZGdlUHV0RXZlbnRzKHRoaXMsICdFbWl0VHJhbnNjb2RlRmFpbGVkRXZlbnQnLCB7XG4gICAgICBlbnRyaWVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBldmVudEJ1czogcHJvcHMuZXZlbnRCdXMsXG4gICAgICAgICAgc291cmNlOiBFVkVOVF9TT1VSQ0UsXG4gICAgICAgICAgZGV0YWlsVHlwZTogJ1ZpZGVvLlRyYW5zY29kZUZhaWxlZCcsXG4gICAgICAgICAgZGV0YWlsOiBzZm4uVGFza0lucHV0LmZyb21PYmplY3Qoe1xuICAgICAgICAgICAgdmlkZW9JZDogc2ZuLkpzb25QYXRoLnN0cmluZ0F0KCckLnRyYW5zY29kZVJlc3VsdC52aWRlb0lkJyksXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pLm5leHQobmV3IHNmbi5GYWlsKHRoaXMsICdUcmFuc2NvZGVKb2JGYWlsZWQnLCB7IGVycm9yOiAnVHJhbnNjb2RlSm9iRmFpbGVkJyB9KSk7XG5cbiAgICBjb25zdCB1cGRhdGVWaWRlb0ZhaWxlZCA9IG5ldyB0YXNrcy5EeW5hbW9VcGRhdGVJdGVtKHRoaXMsICdVcGRhdGVWaWRlb1JlY29yZEZhaWxlZCcsIHtcbiAgICAgIHRhYmxlOiBwcm9wcy50YWJsZSxcbiAgICAgIGtleToge1xuICAgICAgICBQSzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQudHJhbnNjb2RlUmVzdWx0LnBrJykpLFxuICAgICAgICBTSzogdGFza3MuRHluYW1vQXR0cmlidXRlVmFsdWUuZnJvbVN0cmluZyhzZm4uSnNvblBhdGguc3RyaW5nQXQoJyQudHJhbnNjb2RlUmVzdWx0LnNrJykpLFxuICAgICAgfSxcbiAgICAgIHVwZGF0ZUV4cHJlc3Npb246ICdTRVQgI3N0YXR1cyA9IDpzdGF0dXMnLFxuICAgICAgZXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7ICcjc3RhdHVzJzogJ3N0YXR1cycgfSxcbiAgICAgIGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgJzpzdGF0dXMnOiB0YXNrcy5EeW5hbW9BdHRyaWJ1dGVWYWx1ZS5mcm9tU3RyaW5nKCdGQUlMRUQnKSxcbiAgICAgIH0sXG4gICAgICByZXN1bHRQYXRoOiBzZm4uSnNvblBhdGguRElTQ0FSRCxcbiAgICB9KS5uZXh0KGVtaXRGYWlsZWRFdmVudCk7XG5cbiAgICBjb25zdCBzdGF0dXNDaG9pY2UgPSBuZXcgc2ZuLkNob2ljZSh0aGlzLCAnVHJhbnNjb2RlU3RhdHVzQ2hvaWNlJylcbiAgICAgIC53aGVuKHNmbi5Db25kaXRpb24uc3RyaW5nRXF1YWxzKCckLnRyYW5zY29kZVJlc3VsdC5zdGF0dXMnLCAnUkVBRFknKSwgdXBkYXRlVmlkZW9SZWFkeSlcbiAgICAgIC5vdGhlcndpc2UodXBkYXRlVmlkZW9GYWlsZWQpO1xuXG4gICAgY29uc3QgZGVmaW5pdGlvbiA9IHN1Ym1pdEpvYi5uZXh0KHN0YXR1c0Nob2ljZSk7XG5cbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdUcmFuc2NvZGVTdGF0ZU1hY2hpbmVMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9jb3Vyc2UtcGxhdGZvcm0vJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0vdmlkZW8tdHJhbnNjb2RlYCxcbiAgICAgIHJldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLlRXT19XRUVLUyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICB0aGlzLnN0YXRlTWFjaGluZSA9IG5ldyBzZm4uU3RhdGVNYWNoaW5lKHRoaXMsICdWaWRlb1RyYW5zY29kZVN0YXRlTWFjaGluZScsIHtcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0tdmlkZW8tdHJhbnNjb2RlYCxcbiAgICAgIGRlZmluaXRpb25Cb2R5OiBzZm4uRGVmaW5pdGlvbkJvZHkuZnJvbUNoYWluYWJsZShkZWZpbml0aW9uKSxcbiAgICAgIGxvZ3M6IHsgZGVzdGluYXRpb246IGxvZ0dyb3VwLCBsZXZlbDogc2ZuLkxvZ0xldmVsLkFMTCB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5zdGF0ZU1hY2hpbmUuZ3JhbnRUYXNrUmVzcG9uc2UoY29tcGxldGVUcmFuc2NvZGVKb2JGbik7XG5cbiAgICAvLyBUcmlnZ2VyOiByYXcgYnVja2V0IHVwbG9hZCAtPiBzdGF0ZSBtYWNoaW5lIChTMyAtPiBFdmVudEJyaWRnZSBkZWZhdWx0IGJ1cyAtPiBydWxlKVxuICAgIG5ldyBldmVudHMuUnVsZSh0aGlzLCAnUmF3VXBsb2FkUnVsZScsIHtcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnYXdzLnMzJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnT2JqZWN0IENyZWF0ZWQnXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgYnVja2V0OiB7IG5hbWU6IFtwcm9wcy5yYXdVcGxvYWRzQnVja2V0LmJ1Y2tldE5hbWVdIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW25ldyB0YXJnZXRzLlNmblN0YXRlTWFjaGluZSh0aGlzLnN0YXRlTWFjaGluZSldLFxuICAgIH0pO1xuXG4gICAgLy8gTWVkaWFDb252ZXJ0IHJlcG9ydHMgam9iIGNvbXBsZXRpb24gb24gdGhlIEFXUyBkZWZhdWx0IGJ1cyAoQVdTLXNlcnZpY2UgZXZlbnRzIG5ldmVyXG4gICAgLy8gbGFuZCBvbiBhIGN1c3RvbSBidXMpLCBzbyB0aGlzIHJ1bGUgbGl2ZXMgb24gdGhlIGFjY291bnQncyBkZWZhdWx0IGJ1cyB0b28uXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdNZWRpYUNvbnZlcnRKb2JTdGF0ZUNoYW5nZVJ1bGUnLCB7XG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2F3cy5tZWRpYWNvbnZlcnQnXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydNZWRpYUNvbnZlcnQgSm9iIFN0YXRlIENoYW5nZSddLFxuICAgICAgICBkZXRhaWw6IHsgc3RhdHVzOiBbJ0NPTVBMRVRFJywgJ0VSUk9SJ10gfSxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oY29tcGxldGVUcmFuc2NvZGVKb2JGbildLFxuICAgIH0pO1xuXG4gICAgY3JlYXRlU3RyZWFtVG9FdmVudEJyaWRnZVBpcGUodGhpcywgJ1ZpZGVvU3RyZWFtUGlwZScsIHtcbiAgICAgIHRhYmxlU3RyZWFtQXJuOiBwcm9wcy50YWJsZVN0cmVhbUFybixcbiAgICAgIGV2ZW50QnVzOiBwcm9wcy5ldmVudEJ1cyxcbiAgICAgIHNvdXJjZTogRVZFTlRfU09VUkNFLFxuICAgICAgZGV0YWlsVHlwZTogJ1ZpZGVvRGF0YUNoYW5nZWQnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY21TZXJ2aWNlID0gcHJvcHMubmFtZXNwYWNlLmNyZWF0ZVNlcnZpY2UoJ1ZpZGVvUmVnaXN0cnknLCB7XG4gICAgICBuYW1lOiAndmlkZW8tdXBsb2FkLXRyYW5zY29kZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZpZGVvIFVwbG9hZCAmIFRyYW5zY29kZSBtaWNyb3NlcnZpY2UnLFxuICAgIH0pO1xuICAgIGNtU2VydmljZS5yZWdpc3Rlck5vbklwSW5zdGFuY2UoJ0luc3RhbmNlJywge1xuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICBTVEFURV9NQUNISU5FX0FSTjogdGhpcy5zdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgICBDTE9VREZST05UX0RPTUFJTjogcHJvcHMuZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdQcm9qZWN0JywgJ2NvdXJzZS1wbGF0Zm9ybScpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZDb25maWcuZW52TmFtZSk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdNaWNyb3NlcnZpY2UnLCAndmlkZW8nKTtcbiAgfVxufVxuIl19