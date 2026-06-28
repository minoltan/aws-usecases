import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface MonitoringStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  examService: ecs_patterns.ApplicationLoadBalancedFargateService;
  submissionService: ecs_patterns.ApplicationLoadBalancedFargateService;
  submissionQueue: sqs.IQueue;
  submissionDlq: sqs.IQueue;
  table: dynamodb.ITable;
  resultProcessorFn: lambda.IFunction;
  restApi: apigateway.RestApi;
  stateMachine: sfn.IStateMachine;
}

export class MonitoringStack extends cdk.Stack {
  public readonly opsAlertTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    this.opsAlertTopic = new sns.Topic(this, 'OpsAlertTopic', {
      topicName: `${props.envConfig.domainPrefix}-ops-alerts`,
      displayName: 'Exam Platform Ops Alerts',
    });
    this.opsAlertTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.envConfig.alarmEmail),
    );
    const alertAction = new cloudwatch_actions.SnsAction(this.opsAlertTopic);

    this.buildAlarms(props, alertAction);
    this.dashboard = this.buildDashboard(props);

    new cdk.CfnOutput(this, 'OpsAlertTopicArn', {
      value: this.opsAlertTopic.topicArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-OpsAlertTopicArn`,
    });
    new cdk.CfnOutput(this, 'DashboardName', {
      value: this.dashboard.dashboardName,
      exportName: `ExamPlatform-${props.envConfig.envName}-DashboardName`,
    });

    cdk.Tags.of(this).add('Project', 'ExamPlatform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
  }

  private buildAlarms(props: MonitoringStackProps, action: cloudwatch_actions.SnsAction): void {
    props.submissionDlq
      .metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(1) })
      .createAlarm(this, 'DlqDepthAlarm', {
        alarmName: `${props.envConfig.domainPrefix}-dlq-depth`,
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
      .addAlarmAction(action);

    const resultProcessorErrorRate = new cloudwatch.MathExpression({
      expression: '(errors / MAX([invocations, 1])) * 100',
      usingMetrics: {
        errors: props.resultProcessorFn.metricErrors({ period: cdk.Duration.minutes(5) }),
        invocations: props.resultProcessorFn.metricInvocations({ period: cdk.Duration.minutes(5) }),
      },
    });
    resultProcessorErrorRate
      .createAlarm(this, 'ResultProcessorErrorRateAlarm', {
        alarmName: `${props.envConfig.domainPrefix}-result-processor-error-rate`,
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
      .addAlarmAction(action);

    for (const [name, service] of [
      ['ExamService', props.examService],
      ['SubmissionService', props.submissionService],
    ] as const) {
      service.service
        .metricCpuUtilization({ period: cdk.Duration.minutes(5) })
        .createAlarm(this, `${name}CpuAlarm`, {
          alarmName: `${props.envConfig.domainPrefix}-${name.toLowerCase()}-cpu`,
          threshold: 85,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        })
        .addAlarmAction(action);
    }

    props.restApi
      .metricServerError({ period: cdk.Duration.minutes(1), statistic: 'Sum' })
      .createAlarm(this, 'ApiGateway5xxAlarm', {
        alarmName: `${props.envConfig.domainPrefix}-apigw-5xx`,
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
      .addAlarmAction(action);

    new cloudwatch.Alarm(this, 'DynamoDbThrottleAlarm', {
      alarmName: `${props.envConfig.domainPrefix}-dynamodb-throttles`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        dimensionsMap: { TableName: props.table.tableName },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(action);

    new cloudwatch.Alarm(this, 'StateMachineFailedAlarm', {
      alarmName: `${props.envConfig.domainPrefix}-stepfn-failures`,
      metric: props.stateMachine.metricFailed({ period: cdk.Duration.minutes(1), statistic: 'Sum' }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(action);
  }

  private buildDashboard(props: MonitoringStackProps): cloudwatch.Dashboard {
    const dashboard = new cloudwatch.Dashboard(this, 'ExamPlatformDashboard', {
      dashboardName: 'ExamPlatformDashboard',
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS CPU Utilization',
        left: [
          props.examService.service.metricCpuUtilization({ label: 'Exam Service' }),
          props.submissionService.service.metricCpuUtilization({ label: 'Submission Service' }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Memory Utilization',
        left: [
          props.examService.service.metricMemoryUtilization({ label: 'Exam Service' }),
          props.submissionService.service.metricMemoryUtilization({ label: 'Submission Service' }),
        ],
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'SQS Queue Depth',
        left: [
          props.submissionQueue.metricApproximateNumberOfMessagesVisible({ label: 'SubmissionQueue' }),
          props.submissionDlq.metricApproximateNumberOfMessagesVisible({ label: 'SubmissionDLQ' }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Consumed Capacity',
        left: [
          props.table.metricConsumedReadCapacityUnits({ label: 'Read' }),
          props.table.metricConsumedWriteCapacityUnits({ label: 'Write' }),
        ],
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [props.resultProcessorFn.metricErrors({ label: 'ResultProcessor' })],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway 4xx/5xx',
        left: [
          props.restApi.metricClientError({ label: '4xx' }),
          props.restApi.metricServerError({ label: '5xx' }),
        ],
      }),
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Step Functions Failures',
        left: [props.stateMachine.metricFailed({ label: 'Failed executions' })],
        width: 12,
      }),
    );

    return dashboard;
  }
}
