#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SqsPatternsStack } from '../lib/sqs-patterns-stack';

const app = new cdk.App({
  context: {
    deploymentRegion: process.env.CDK_DEFAULT_REGION || 'ap-southeast-1'
  }
});

new SqsPatternsStack(app, 'SqsPatternsStack', {
  description: 'Stack demonstrating SQS patterns for order and payment processing'
});