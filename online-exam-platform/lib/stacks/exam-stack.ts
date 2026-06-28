import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environment';

export interface ExamStackProps extends cdk.StackProps {
  envConfig: EnvironmentConfig;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
  ecsSecurityGroup: ec2.ISecurityGroup;
  table: dynamodb.ITable;
  questionBucket: s3.IBucket;
  stateMachineArn: string;
  submissionQueueUrl: string;
  submissionQueueArn: string;
  schedulerExecutionRoleArn: string;
  autoSubmitFunctionArn: string;
}

export class ExamStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly examService: ecs_patterns.ApplicationLoadBalancedFargateService;
  public readonly submissionService: ecs_patterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: ExamStackProps) {
    super(scope, id, props);

    this.cluster = new ecs.Cluster(this, 'ExamPlatformCluster', {
      clusterName: 'ExamPlatformCluster',
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // CDK creates the repos; it does not build/push into them. The real
    // Java 21 / Spring Boot images (services/exam-service,
    // services/submission-service) are built and pushed by
    // scripts/build-and-push-services.sh (or a CI pipeline later) — see
    // docs/deploying-services.md. ECS tasks won't start until the first
    // push completes; that's an expected one-time bootstrap step, not a
    // synth/deploy failure.
    const isProd = props.envConfig.envName === 'prod';
    const examServiceRepo = new ecr.Repository(this, 'ExamServiceRepo', {
      repositoryName: 'exam-service',
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10 }],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: !isProd,
    });
    const submissionServiceRepo = new ecr.Repository(this, 'SubmissionServiceRepo', {
      repositoryName: 'submission-service',
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10 }],
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: !isProd,
    });

    // Both load balancers share NetworkStack's alb-sg so the pattern's
    // auto-wired ALB<->task ingress rule stays on NetworkStack-owned security
    // groups on both ends — mixing a Network-owned SG with an ExamStack-auto-
    // created one here would create a cross-stack dependency cycle.
    const examAlb = new elbv2.ApplicationLoadBalancer(this, 'ExamServiceAlb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
    });
    const submissionAlb = new elbv2.ApplicationLoadBalancer(this, 'SubmissionServiceAlb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
    });

    this.examService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'ExamService', {
      cluster: this.cluster,
      serviceName: 'exam-service',
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: props.envConfig.examServiceMinCapacity,
      minHealthyPercent: 100,
      securityGroups: [props.ecsSecurityGroup],
      loadBalancer: examAlb,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(examServiceRepo, 'latest'),
        containerPort: 8080,
        environment: {
          TABLE_NAME: props.table.tableName,
          QUESTION_BUCKET: props.questionBucket.bucketName,
          STATE_MACHINE_ARN: props.stateMachineArn,
          SCHEDULER_EXECUTION_ROLE_ARN: props.schedulerExecutionRoleArn,
          AUTO_SUBMIT_FUNCTION_ARN: props.autoSubmitFunctionArn,
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'exam-service',
          logGroup: new logs.LogGroup(this, 'ExamServiceLogGroup', {
            logGroupName: '/exam-platform/exam-service',
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        }),
      },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });
    this.examService.targetGroup.configureHealthCheck({ path: '/actuator/health' });

    props.table.grantReadWriteData(this.examService.taskDefinition.taskRole);
    props.questionBucket.grantRead(this.examService.taskDefinition.taskRole);
    this.examService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['states:StartExecution'],
        resources: [props.stateMachineArn],
      }),
    );
    // Lets the Exam Service create one EventBridge Scheduler schedule per session
    // (auto-submit timer) and hand it the role that schedule will assume.
    this.examService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule', 'scheduler:UpdateSchedule'],
        resources: ['*'],
      }),
    );
    this.examService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [props.schedulerExecutionRoleArn],
      }),
    );

    this.configureScaling(this.examService, {
      min: props.envConfig.examServiceMinCapacity,
      max: props.envConfig.examServiceMaxCapacity,
      scaleOnRequests: 1000,
      prewarm: true,
    });

    this.submissionService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      'SubmissionService',
      {
        cluster: this.cluster,
        serviceName: 'submission-service',
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: props.envConfig.submissionServiceMinCapacity,
        minHealthyPercent: 100,
        securityGroups: [props.ecsSecurityGroup],
        loadBalancer: submissionAlb,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(submissionServiceRepo, 'latest'),
          containerPort: 8080,
          environment: {
            TABLE_NAME: props.table.tableName,
            SUBMISSION_QUEUE_URL: props.submissionQueueUrl,
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'submission-service',
            logGroup: new logs.LogGroup(this, 'SubmissionServiceLogGroup', {
              logGroupName: '/exam-platform/submission-service',
              retention: logs.RetentionDays.ONE_MONTH,
              removalPolicy: cdk.RemovalPolicy.DESTROY,
            }),
          }),
        },
        healthCheckGracePeriod: cdk.Duration.seconds(60),
      },
    );
    this.submissionService.targetGroup.configureHealthCheck({ path: '/actuator/health' });

    new iam.Policy(this, 'SubmissionServiceQueuePolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['sqs:SendMessage'],
          resources: [props.submissionQueueArn],
        }),
      ],
    }).attachToRole(this.submissionService.taskDefinition.taskRole);
    this.submissionService.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:UpdateItem'],
        resources: [props.table.tableArn],
      }),
    );

    this.configureScaling(this.submissionService, {
      min: props.envConfig.submissionServiceMinCapacity,
      max: props.envConfig.submissionServiceMaxCapacity,
      scaleOnRequests: 1000,
    });

    new cdk.CfnOutput(this, 'ExamServiceAlbDns', {
      value: this.examService.loadBalancer.loadBalancerDnsName,
      exportName: `ExamPlatform-${props.envConfig.envName}-ExamServiceAlbDns`,
    });
    new cdk.CfnOutput(this, 'SubmissionServiceAlbDns', {
      value: this.submissionService.loadBalancer.loadBalancerDnsName,
      exportName: `ExamPlatform-${props.envConfig.envName}-SubmissionServiceAlbDns`,
    });
    new cdk.CfnOutput(this, 'EcsClusterArn', {
      value: this.cluster.clusterArn,
      exportName: `ExamPlatform-${props.envConfig.envName}-EcsClusterArn`,
    });
    new cdk.CfnOutput(this, 'ExamServiceRepoUri', {
      value: examServiceRepo.repositoryUri,
      description: 'docker push target for services/exam-service — see docs/deploying-services.md',
    });
    new cdk.CfnOutput(this, 'SubmissionServiceRepoUri', {
      value: submissionServiceRepo.repositoryUri,
      description: 'docker push target for services/submission-service — see docs/deploying-services.md',
    });

    cdk.Tags.of(this).add('Project', 'ExamPlatform');
    cdk.Tags.of(this).add('Environment', props.envConfig.envName);
  }

  /** Pre-warm (set via `prewarm`) scales min capacity up ahead of the daily peak exam
   *  window and back down overnight — same ScalableTaskCount as the CPU/request rules,
   *  since autoScaleTaskCount can only be invoked once per service. */
  private configureScaling(
    service: ecs_patterns.ApplicationLoadBalancedFargateService,
    opts: { min: number; max: number; scaleOnRequests: number; prewarm?: boolean },
  ): void {
    const scalableTarget = service.service.autoScaleTaskCount({
      minCapacity: opts.min,
      maxCapacity: opts.max,
    });
    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    scalableTarget.scaleOnRequestCount('RequestScaling', {
      requestsPerTarget: opts.scaleOnRequests,
      targetGroup: service.targetGroup,
    });

    if (opts.prewarm) {
      scalableTarget.scaleOnSchedule('PrewarmBeforePeak', {
        schedule: applicationautoscaling.Schedule.cron({ hour: '8', minute: '45' }),
        minCapacity: 20,
      });
      scalableTarget.scaleOnSchedule('ScaleDownAfterPeak', {
        schedule: applicationautoscaling.Schedule.cron({ hour: '18', minute: '0' }),
        minCapacity: opts.min,
      });
    }
  }
}
