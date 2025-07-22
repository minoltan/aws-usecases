#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { StreakSystemStack } from '../lib/streak-system-stack';

const app = new cdk.App({
   context: {
    deploymentRegion: process.env.CDK_DEFAULT_REGION || 'ap-southeast-1'
  }
});
new StreakSystemStack(app, 'StreakSystemStack', {
 
});