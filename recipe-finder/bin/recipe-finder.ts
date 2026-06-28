#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RecipeFinderStack } from '../lib/recipe-finder-stack';

const app = new cdk.App();
new RecipeFinderStack(app, 'RecipeFinderStack', {
  // Pinned to us-east-1: this is where Bedrock Knowledge Bases backed by S3 Vectors and the
  // Claude cross-region inference profile used by this stack are most reliably available.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
});
