#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { getEnvironmentConfig } from '../lib/config/environment';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { AsyncStack } from '../lib/stacks/async-stack';
import { ExamStack } from '../lib/stacks/exam-stack';
import { WafStack } from '../lib/stacks/waf-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? process.env.ENVIRONMENT ?? 'dev';
const envConfig = getEnvironmentConfig(envName);
const env = { account: envConfig.account, region: envConfig.region };
const stackPrefix = `ExamPlatform-${envConfig.envName}`;

const network = new NetworkStack(app, `${stackPrefix}-Network`, { env, envConfig });

const data = new DataStack(app, `${stackPrefix}-Data`, { env, envConfig });

const auth = new AuthStack(app, `${stackPrefix}-Auth`, {
  env,
  envConfig,
  table: data.table,
});

const asyncStack = new AsyncStack(app, `${stackPrefix}-Async`, {
  env,
  envConfig,
  table: data.table,
});

const exam = new ExamStack(app, `${stackPrefix}-Exam`, {
  env,
  envConfig,
  vpc: network.vpc,
  albSecurityGroup: network.albSecurityGroup,
  ecsSecurityGroup: network.ecsSecurityGroup,
  table: data.table,
  questionBucket: data.questionBucket,
  stateMachineArn: asyncStack.stateMachine.stateMachineArn,
  submissionQueueUrl: asyncStack.submissionQueue.queueUrl,
  submissionQueueArn: asyncStack.submissionQueue.queueArn,
  schedulerExecutionRoleArn: asyncStack.schedulerExecutionRole.roleArn,
  autoSubmitFunctionArn: asyncStack.autoSubmitFn.functionArn,
});

// CLOUDFRONT-scoped WAFv2 Web ACLs only exist in us-east-1, regardless of the
// rest of the platform's home region — see waf-stack.ts.
const waf = new WafStack(app, `${stackPrefix}-Waf`, {
  env: { account: envConfig.account, region: 'us-east-1' },
  envConfig,
  crossRegionReferences: true,
});

const api = new ApiStack(app, `${stackPrefix}-Api`, {
  env,
  envConfig,
  crossRegionReferences: true,
  userPool: auth.userPool,
  authorizerFn: auth.authorizerFn,
  table: data.table,
  questionBucket: data.questionBucket,
  examServiceAlbDns: exam.examService.loadBalancer.loadBalancerDnsName,
  submissionServiceAlbDns: exam.submissionService.loadBalancer.loadBalancerDnsName,
  webAclArn: waf.webAcl.attrArn,
});

new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  envConfig,
  examService: exam.examService,
  submissionService: exam.submissionService,
  submissionQueue: asyncStack.submissionQueue,
  submissionDlq: asyncStack.submissionDlq,
  table: data.table,
  resultProcessorFn: asyncStack.resultProcessorFn,
  restApi: api.restApi,
  stateMachine: asyncStack.stateMachine,
});

app.synth();
