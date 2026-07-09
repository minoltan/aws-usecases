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
exports.AnalyticsServiceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const athena = __importStar(require("aws-cdk-lib/aws-athena"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const glue = __importStar(require("aws-cdk-lib/aws-glue"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const firehose = __importStar(require("aws-cdk-lib/aws-kinesisfirehose"));
const create_handler_1 = require("../../shared/create-handler");
/**
 * The modern replacement for the book's Redshift cluster + scheduled ETL (Serverless
 * Architectures on AWS, 2nd Ed., Fig 5.5): every microservice's domain events (business
 * events + DynamoDB-Streams-via-Pipes CDC events) land on the shared bus; this stack's
 * rule fans them straight into Firehose -> S3, queryable via Glue + Athena. No Lambda
 * sits in the ingest path, and no other microservice has a hard dependency on this one.
 */
class AnalyticsServiceStack extends cdk.Stack {
    getCourseEnrollmentStatsFn;
    constructor(scope, id, props) {
        super(scope, id, props);
        const database = new glue.CfnDatabase(this, 'AnalyticsDatabase', {
            catalogId: cdk.Aws.ACCOUNT_ID,
            databaseInput: {
                name: `course_platform_analytics_${props.envConfig.envName}`,
            },
        });
        // Partition projection over year/month/day -- no Glue Crawler needed, and new
        // partitions become queryable the instant Firehose writes them.
        const rawEventsTable = new glue.CfnTable(this, 'RawEventsTable', {
            catalogId: cdk.Aws.ACCOUNT_ID,
            databaseName: database.ref,
            tableInput: {
                name: 'raw_events',
                tableType: 'EXTERNAL_TABLE',
                parameters: {
                    classification: 'json',
                    'projection.enabled': 'true',
                    'projection.year.type': 'integer',
                    'projection.year.range': '2024,2100',
                    'projection.month.type': 'integer',
                    'projection.month.range': '1,12',
                    'projection.month.digits': '2',
                    'projection.day.type': 'integer',
                    'projection.day.range': '1,31',
                    'projection.day.digits': '2',
                    'storage.location.template': `s3://${props.dataLakeBucket.bucketName}/raw/\${year}/\${month}/\${day}`,
                },
                partitionKeys: [
                    { name: 'year', type: 'string' },
                    { name: 'month', type: 'string' },
                    { name: 'day', type: 'string' },
                ],
                storageDescriptor: {
                    location: `s3://${props.dataLakeBucket.bucketName}/raw/`,
                    inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
                    outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
                    serdeInfo: {
                        serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
                    },
                    columns: [
                        { name: 'version', type: 'string' },
                        { name: 'id', type: 'string' },
                        { name: 'detail-type', type: 'string' },
                        { name: 'source', type: 'string' },
                        { name: 'account', type: 'string' },
                        { name: 'time', type: 'string' },
                        { name: 'region', type: 'string' },
                        { name: 'resources', type: 'array<string>' },
                        { name: 'detail', type: 'string' },
                    ],
                },
            },
        });
        rawEventsTable.addDependency(database);
        const workgroup = new athena.CfnWorkGroup(this, 'AnalyticsWorkgroup', {
            name: `course-platform-${props.envConfig.envName}-analytics`,
            workGroupConfiguration: {
                resultConfiguration: {
                    outputLocation: `s3://${props.dataLakeBucket.bucketName}/athena-results/`,
                },
            },
        });
        const deliveryStream = new firehose.DeliveryStream(this, 'AnalyticsDeliveryStream', {
            deliveryStreamName: `course-platform-${props.envConfig.envName}-analytics`,
            destination: new firehose.S3Bucket(props.dataLakeBucket, {
                dataOutputPrefix: 'raw/!{timestamp:yyyy}/!{timestamp:MM}/!{timestamp:dd}/',
                errorOutputPrefix: 'raw-errors/!{firehose:error-output-type}/',
                bufferingInterval: cdk.Duration.seconds(300),
                bufferingSize: cdk.Size.mebibytes(5),
                compression: firehose.Compression.GZIP,
            }),
        });
        // Zero Lambda in the ingest path -- every microservice's business events and CDC
        // change events (both stamped with a 'course-platform.*' source) land here. Listed
        // explicitly rather than via a prefix match, since CDK's typed EventPattern.source
        // only accepts literal source names.
        new events.Rule(this, 'AnalyticsIngestRule', {
            eventBus: props.eventBus,
            eventPattern: {
                source: [
                    'course-platform.course-catalog',
                    'course-platform.video',
                    'course-platform.enrollment',
                    'course-platform.discussion',
                ],
            },
            targets: [new targets.FirehoseDeliveryStream(deliveryStream)],
        });
        this.getCourseEnrollmentStatsFn = (0, create_handler_1.createHandler)(this, 'GetCourseEnrollmentStatsFunction', {
            domain: 'analytics',
            name: 'getCourseEnrollmentStats',
            timeout: cdk.Duration.seconds(30),
            environment: {
                GLUE_DATABASE: database.ref,
                ATHENA_WORKGROUP: workgroup.name,
                RESULTS_BUCKET_NAME: props.dataLakeBucket.bucketName,
            },
        });
        this.getCourseEnrollmentStatsFn.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'athena:StartQueryExecution',
                'athena:GetQueryExecution',
                'athena:GetQueryResults',
                'glue:GetTable',
                'glue:GetDatabase',
                'glue:GetPartitions',
            ],
            resources: ['*'],
        }));
        props.dataLakeBucket.grantReadWrite(this.getCourseEnrollmentStatsFn);
        const cmService = props.namespace.createService('AnalyticsRegistry', {
            name: 'reporting-analytics',
            description: 'Reporting & Analytics microservice',
        });
        cmService.registerNonIpInstance('Instance', {
            customAttributes: {
                GLUE_DATABASE: database.ref,
                ATHENA_WORKGROUP: workgroup.name,
            },
        });
        cdk.Tags.of(this).add('Project', 'course-platform');
        cdk.Tags.of(this).add('Environment', props.envConfig.envName);
        cdk.Tags.of(this).add('Microservice', 'analytics');
    }
}
exports.AnalyticsServiceStack = AnalyticsServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl0aWNzLXNlcnZpY2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhbmFseXRpY3Mtc2VydmljZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQsMkRBQTZDO0FBQzdDLHlEQUEyQztBQUMzQywwRUFBNEQ7QUFNNUQsZ0VBQTREO0FBUzVEOzs7Ozs7R0FNRztBQUNILE1BQWEscUJBQXNCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbEMsMEJBQTBCLENBQWlCO0lBRTNELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBaUM7UUFDekUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMvRCxTQUFTLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVO1lBQzdCLGFBQWEsRUFBRTtnQkFDYixJQUFJLEVBQUUsNkJBQTZCLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFO2FBQzdEO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsOEVBQThFO1FBQzlFLGdFQUFnRTtRQUNoRSxNQUFNLGNBQWMsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQy9ELFNBQVMsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVU7WUFDN0IsWUFBWSxFQUFFLFFBQVEsQ0FBQyxHQUFHO1lBQzFCLFVBQVUsRUFBRTtnQkFDVixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsU0FBUyxFQUFFLGdCQUFnQjtnQkFDM0IsVUFBVSxFQUFFO29CQUNWLGNBQWMsRUFBRSxNQUFNO29CQUN0Qixv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QUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1FBRXJFLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLG1CQUFtQixFQUFFO1lBQ25FLElBQUksRUFBRSxxQkFBcUI7WUFDM0IsV0FBVyxFQUFFLG9DQUFvQztTQUNsRCxDQUFDLENBQUM7UUFDSCxTQUFTLENBQUMscUJBQXFCLENBQUMsVUFBVSxFQUFFO1lBQzFDLGdCQUFnQixFQUFFO2dCQUNoQixhQUFhLEVBQUUsUUFBUSxDQUFDLEdBQUc7Z0JBQzNCLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxJQUFLO2FBQ2xDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3BELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3JELENBQUM7Q0FDRjtBQTNJRCxzREEySUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYXRoZW5hIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hdGhlbmEnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgZ2x1ZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZ2x1ZSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBmaXJlaG9zZSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mta2luZXNpc2ZpcmVob3NlJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIHNlcnZpY2VkaXNjb3ZlcnkgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlcnZpY2VkaXNjb3ZlcnknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudCc7XG5pbXBvcnQgeyBjcmVhdGVIYW5kbGVyIH0gZnJvbSAnLi4vLi4vc2hhcmVkL2NyZWF0ZS1oYW5kbGVyJztcblxuZXhwb3J0IGludGVyZmFjZSBBbmFseXRpY3NTZXJ2aWNlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52Q29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgZGF0YUxha2VCdWNrZXQ6IHMzLklCdWNrZXQ7XG4gIGV2ZW50QnVzOiBldmVudHMuSUV2ZW50QnVzO1xuICBuYW1lc3BhY2U6IHNlcnZpY2VkaXNjb3ZlcnkuSHR0cE5hbWVzcGFjZTtcbn1cblxuLyoqXG4gKiBUaGUgbW9kZXJuIHJlcGxhY2VtZW50IGZvciB0aGUgYm9vaydzIFJlZHNoaWZ0IGNsdXN0ZXIgKyBzY2hlZHVsZWQgRVRMIChTZXJ2ZXJsZXNzXG4gKiBBcmNoaXRlY3R1cmVzIG9uIEFXUywgMm5kIEVkLiwgRmlnIDUuNSk6IGV2ZXJ5IG1pY3Jvc2VydmljZSdzIGRvbWFpbiBldmVudHMgKGJ1c2luZXNzXG4gKiBldmVudHMgKyBEeW5hbW9EQi1TdHJlYW1zLXZpYS1QaXBlcyBDREMgZXZlbnRzKSBsYW5kIG9uIHRoZSBzaGFyZWQgYnVzOyB0aGlzIHN0YWNrJ3NcbiAqIHJ1bGUgZmFucyB0aGVtIHN0cmFpZ2h0IGludG8gRmlyZWhvc2UgLT4gUzMsIHF1ZXJ5YWJsZSB2aWEgR2x1ZSArIEF0aGVuYS4gTm8gTGFtYmRhXG4gKiBzaXRzIGluIHRoZSBpbmdlc3QgcGF0aCwgYW5kIG5vIG90aGVyIG1pY3Jvc2VydmljZSBoYXMgYSBoYXJkIGRlcGVuZGVuY3kgb24gdGhpcyBvbmUuXG4gKi9cbmV4cG9ydCBjbGFzcyBBbmFseXRpY3NTZXJ2aWNlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0Q291cnNlRW5yb2xsbWVudFN0YXRzRm46IE5vZGVqc0Z1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBbmFseXRpY3NTZXJ2aWNlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgZGF0YWJhc2UgPSBuZXcgZ2x1ZS5DZm5EYXRhYmFzZSh0aGlzLCAnQW5hbHl0aWNzRGF0YWJhc2UnLCB7XG4gICAgICBjYXRhbG9nSWQ6IGNkay5Bd3MuQUNDT1VOVF9JRCxcbiAgICAgIGRhdGFiYXNlSW5wdXQ6IHtcbiAgICAgICAgbmFtZTogYGNvdXJzZV9wbGF0Zm9ybV9hbmFseXRpY3NfJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX1gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFBhcnRpdGlvbiBwcm9qZWN0aW9uIG92ZXIgeWVhci9tb250aC9kYXkgLS0gbm8gR2x1ZSBDcmF3bGVyIG5lZWRlZCwgYW5kIG5ld1xuICAgIC8vIHBhcnRpdGlvbnMgYmVjb21lIHF1ZXJ5YWJsZSB0aGUgaW5zdGFudCBGaXJlaG9zZSB3cml0ZXMgdGhlbS5cbiAgICBjb25zdCByYXdFdmVudHNUYWJsZSA9IG5ldyBnbHVlLkNmblRhYmxlKHRoaXMsICdSYXdFdmVudHNUYWJsZScsIHtcbiAgICAgIGNhdGFsb2dJZDogY2RrLkF3cy5BQ0NPVU5UX0lELFxuICAgICAgZGF0YWJhc2VOYW1lOiBkYXRhYmFzZS5yZWYsXG4gICAgICB0YWJsZUlucHV0OiB7XG4gICAgICAgIG5hbWU6ICdyYXdfZXZlbnRzJyxcbiAgICAgICAgdGFibGVUeXBlOiAnRVhURVJOQUxfVEFCTEUnLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgY2xhc3NpZmljYXRpb246ICdqc29uJyxcbiAgICAgICAgICAncHJvamVjdGlvbi5lbmFibGVkJzogJ3RydWUnLFxuICAgICAgICAgICdwcm9qZWN0aW9uLnllYXIudHlwZSc6ICdpbnRlZ2VyJyxcbiAgICAgICAgICAncHJvamVjdGlvbi55ZWFyLnJhbmdlJzogJzIwMjQsMjEwMCcsXG4gICAgICAgICAgJ3Byb2plY3Rpb24ubW9udGgudHlwZSc6ICdpbnRlZ2VyJyxcbiAgICAgICAgICAncHJvamVjdGlvbi5tb250aC5yYW5nZSc6ICcxLDEyJyxcbiAgICAgICAgICAncHJvamVjdGlvbi5tb250aC5kaWdpdHMnOiAnMicsXG4gICAgICAgICAgJ3Byb2plY3Rpb24uZGF5LnR5cGUnOiAnaW50ZWdlcicsXG4gICAgICAgICAgJ3Byb2plY3Rpb24uZGF5LnJhbmdlJzogJzEsMzEnLFxuICAgICAgICAgICdwcm9qZWN0aW9uLmRheS5kaWdpdHMnOiAnMicsXG4gICAgICAgICAgJ3N0b3JhZ2UubG9jYXRpb24udGVtcGxhdGUnOiBgczM6Ly8ke3Byb3BzLmRhdGFMYWtlQnVja2V0LmJ1Y2tldE5hbWV9L3Jhdy9cXCR7eWVhcn0vXFwke21vbnRofS9cXCR7ZGF5fWAsXG4gICAgICAgIH0sXG4gICAgICAgIHBhcnRpdGlvbktleXM6IFtcbiAgICAgICAgICB7IG5hbWU6ICd5ZWFyJywgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICB7IG5hbWU6ICdtb250aCcsIHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgeyBuYW1lOiAnZGF5JywgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RvcmFnZURlc2NyaXB0b3I6IHtcbiAgICAgICAgICBsb2NhdGlvbjogYHMzOi8vJHtwcm9wcy5kYXRhTGFrZUJ1Y2tldC5idWNrZXROYW1lfS9yYXcvYCxcbiAgICAgICAgICBpbnB1dEZvcm1hdDogJ29yZy5hcGFjaGUuaGFkb29wLm1hcHJlZC5UZXh0SW5wdXRGb3JtYXQnLFxuICAgICAgICAgIG91dHB1dEZvcm1hdDogJ29yZy5hcGFjaGUuaGFkb29wLmhpdmUucWwuaW8uSGl2ZUlnbm9yZUtleVRleHRPdXRwdXRGb3JtYXQnLFxuICAgICAgICAgIHNlcmRlSW5mbzoge1xuICAgICAgICAgICAgc2VyaWFsaXphdGlvbkxpYnJhcnk6ICdvcmcub3BlbnguZGF0YS5qc29uc2VyZGUuSnNvblNlckRlJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbHVtbnM6IFtcbiAgICAgICAgICAgIHsgbmFtZTogJ3ZlcnNpb24nLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnaWQnLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnZGV0YWlsLXR5cGUnLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnc291cmNlJywgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2FjY291bnQnLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAndGltZScsIHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdyZWdpb24nLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAncmVzb3VyY2VzJywgdHlwZTogJ2FycmF5PHN0cmluZz4nIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdkZXRhaWwnLCB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHJhd0V2ZW50c1RhYmxlLmFkZERlcGVuZGVuY3koZGF0YWJhc2UpO1xuXG4gICAgY29uc3Qgd29ya2dyb3VwID0gbmV3IGF0aGVuYS5DZm5Xb3JrR3JvdXAodGhpcywgJ0FuYWx5dGljc1dvcmtncm91cCcsIHtcbiAgICAgIG5hbWU6IGBjb3Vyc2UtcGxhdGZvcm0tJHtwcm9wcy5lbnZDb25maWcuZW52TmFtZX0tYW5hbHl0aWNzYCxcbiAgICAgIHdvcmtHcm91cENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgcmVzdWx0Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgIG91dHB1dExvY2F0aW9uOiBgczM6Ly8ke3Byb3BzLmRhdGFMYWtlQnVja2V0LmJ1Y2tldE5hbWV9L2F0aGVuYS1yZXN1bHRzL2AsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVsaXZlcnlTdHJlYW0gPSBuZXcgZmlyZWhvc2UuRGVsaXZlcnlTdHJlYW0odGhpcywgJ0FuYWx5dGljc0RlbGl2ZXJ5U3RyZWFtJywge1xuICAgICAgZGVsaXZlcnlTdHJlYW1OYW1lOiBgY291cnNlLXBsYXRmb3JtLSR7cHJvcHMuZW52Q29uZmlnLmVudk5hbWV9LWFuYWx5dGljc2AsXG4gICAgICBkZXN0aW5hdGlvbjogbmV3IGZpcmVob3NlLlMzQnVja2V0KHByb3BzLmRhdGFMYWtlQnVja2V0LCB7XG4gICAgICAgIGRhdGFPdXRwdXRQcmVmaXg6ICdyYXcvIXt0aW1lc3RhbXA6eXl5eX0vIXt0aW1lc3RhbXA6TU19LyF7dGltZXN0YW1wOmRkfS8nLFxuICAgICAgICBlcnJvck91dHB1dFByZWZpeDogJ3Jhdy1lcnJvcnMvIXtmaXJlaG9zZTplcnJvci1vdXRwdXQtdHlwZX0vJyxcbiAgICAgICAgYnVmZmVyaW5nSW50ZXJ2YWw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksXG4gICAgICAgIGJ1ZmZlcmluZ1NpemU6IGNkay5TaXplLm1lYmlieXRlcyg1KSxcbiAgICAgICAgY29tcHJlc3Npb246IGZpcmVob3NlLkNvbXByZXNzaW9uLkdaSVAsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIFplcm8gTGFtYmRhIGluIHRoZSBpbmdlc3QgcGF0aCAtLSBldmVyeSBtaWNyb3NlcnZpY2UncyBidXNpbmVzcyBldmVudHMgYW5kIENEQ1xuICAgIC8vIGNoYW5nZSBldmVudHMgKGJvdGggc3RhbXBlZCB3aXRoIGEgJ2NvdXJzZS1wbGF0Zm9ybS4qJyBzb3VyY2UpIGxhbmQgaGVyZS4gTGlzdGVkXG4gICAgLy8gZXhwbGljaXRseSByYXRoZXIgdGhhbiB2aWEgYSBwcmVmaXggbWF0Y2gsIHNpbmNlIENESydzIHR5cGVkIEV2ZW50UGF0dGVybi5zb3VyY2VcbiAgICAvLyBvbmx5IGFjY2VwdHMgbGl0ZXJhbCBzb3VyY2UgbmFtZXMuXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdBbmFseXRpY3NJbmdlc3RSdWxlJywge1xuICAgICAgZXZlbnRCdXM6IHByb3BzLmV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogW1xuICAgICAgICAgICdjb3Vyc2UtcGxhdGZvcm0uY291cnNlLWNhdGFsb2cnLFxuICAgICAgICAgICdjb3Vyc2UtcGxhdGZvcm0udmlkZW8nLFxuICAgICAgICAgICdjb3Vyc2UtcGxhdGZvcm0uZW5yb2xsbWVudCcsXG4gICAgICAgICAgJ2NvdXJzZS1wbGF0Zm9ybS5kaXNjdXNzaW9uJyxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbbmV3IHRhcmdldHMuRmlyZWhvc2VEZWxpdmVyeVN0cmVhbShkZWxpdmVyeVN0cmVhbSldLFxuICAgIH0pO1xuXG4gICAgdGhpcy5nZXRDb3Vyc2VFbnJvbGxtZW50U3RhdHNGbiA9IGNyZWF0ZUhhbmRsZXIodGhpcywgJ0dldENvdXJzZUVucm9sbG1lbnRTdGF0c0Z1bmN0aW9uJywge1xuICAgICAgZG9tYWluOiAnYW5hbHl0aWNzJyxcbiAgICAgIG5hbWU6ICdnZXRDb3Vyc2VFbnJvbGxtZW50U3RhdHMnLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgR0xVRV9EQVRBQkFTRTogZGF0YWJhc2UucmVmLFxuICAgICAgICBBVEhFTkFfV09SS0dST1VQOiB3b3JrZ3JvdXAubmFtZSEsXG4gICAgICAgIFJFU1VMVFNfQlVDS0VUX05BTUU6IHByb3BzLmRhdGFMYWtlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuZ2V0Q291cnNlRW5yb2xsbWVudFN0YXRzRm4uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2F0aGVuYTpTdGFydFF1ZXJ5RXhlY3V0aW9uJyxcbiAgICAgICAgICAnYXRoZW5hOkdldFF1ZXJ5RXhlY3V0aW9uJyxcbiAgICAgICAgICAnYXRoZW5hOkdldFF1ZXJ5UmVzdWx0cycsXG4gICAgICAgICAgJ2dsdWU6R2V0VGFibGUnLFxuICAgICAgICAgICdnbHVlOkdldERhdGFiYXNlJyxcbiAgICAgICAgICAnZ2x1ZTpHZXRQYXJ0aXRpb25zJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBwcm9wcy5kYXRhTGFrZUJ1Y2tldC5ncmFudFJlYWRXcml0ZSh0aGlzLmdldENvdXJzZUVucm9sbG1lbnRTdGF0c0ZuKTtcblxuICAgIGNvbnN0IGNtU2VydmljZSA9IHByb3BzLm5hbWVzcGFjZS5jcmVhdGVTZXJ2aWNlKCdBbmFseXRpY3NSZWdpc3RyeScsIHtcbiAgICAgIG5hbWU6ICdyZXBvcnRpbmctYW5hbHl0aWNzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVwb3J0aW5nICYgQW5hbHl0aWNzIG1pY3Jvc2VydmljZScsXG4gICAgfSk7XG4gICAgY21TZXJ2aWNlLnJlZ2lzdGVyTm9uSXBJbnN0YW5jZSgnSW5zdGFuY2UnLCB7XG4gICAgICBjdXN0b21BdHRyaWJ1dGVzOiB7XG4gICAgICAgIEdMVUVfREFUQUJBU0U6IGRhdGFiYXNlLnJlZixcbiAgICAgICAgQVRIRU5BX1dPUktHUk9VUDogd29ya2dyb3VwLm5hbWUhLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnUHJvamVjdCcsICdjb3Vyc2UtcGxhdGZvcm0nKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgcHJvcHMuZW52Q29uZmlnLmVudk5hbWUpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnTWljcm9zZXJ2aWNlJywgJ2FuYWx5dGljcycpO1xuICB9XG59XG4iXX0=