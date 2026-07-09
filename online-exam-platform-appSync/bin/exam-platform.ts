#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ExamPlatformStack } from '../lib/exam-platform-stack';

const app = new cdk.App();

new ExamPlatformStack(app, 'ExamPlatformStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-1',
  },
  description: 'Online Exam Platform - Serverless AWS Stack',
});
