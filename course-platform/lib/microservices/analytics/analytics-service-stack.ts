import * as cdk from 'aws-cdk-lib';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';
import { createHandler } from '../../shared/create-handler';

export interface AnalyticsServiceStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  dataLakeBucket: s3.IBucket;
  eventBus: events.IEventBus;
  namespace: servicediscovery.HttpNamespace;
}

/**
 * The modern replacement for the book's Redshift cluster + scheduled ETL (Serverless
 * Architectures on AWS, 2nd Ed., Fig 5.5): every microservice's domain events (business
 * events + DynamoDB-Streams-via-Pipes CDC events) land on the shared bus; this stack's
 * rule fans them straight into Firehose -> S3, queryable via Glue + Athena. No Lambda
 * sits in the ingest path, and no other microservice has a hard dependency on this one.
 */
export class AnalyticsServiceStack extends cdk.Stack {
  public readonly getCourseEnrollmentStatsFn: NodejsFunction;

  constructor(scope: Construct, id: string, props: AnalyticsServiceStackProps) {
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

    this.getCourseEnrollmentStatsFn = createHandler(this, 'GetCourseEnrollmentStatsFunction', {
      domain: 'analytics',
      name: 'getCourseEnrollmentStats',
      timeout: cdk.Duration.seconds(30),
      environment: {
        GLUE_DATABASE: database.ref,
        ATHENA_WORKGROUP: workgroup.name!,
        RESULTS_BUCKET_NAME: props.dataLakeBucket.bucketName,
      },
    });
    this.getCourseEnrollmentStatsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'athena:StartQueryExecution',
          'athena:GetQueryExecution',
          'athena:GetQueryResults',
          'glue:GetTable',
          'glue:GetDatabase',
          'glue:GetPartitions',
        ],
        resources: ['*'],
      })
    );
    props.dataLakeBucket.grantReadWrite(this.getCourseEnrollmentStatsFn);

    const cmService = props.namespace.createService('AnalyticsRegistry', {
      name: 'reporting-analytics',
      description: 'Reporting & Analytics microservice',
    });
    cmService.registerNonIpInstance('Instance', {
      customAttributes: {
        GLUE_DATABASE: database.ref,
        ATHENA_WORKGROUP: workgroup.name!,
      },
    });

    cdk.Tags.of(this).add('Project', 'course-platform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
    cdk.Tags.of(this).add('Microservice', 'analytics');
  }
}
