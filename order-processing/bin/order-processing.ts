import * as cdk from 'aws-cdk-lib/core';
import { OrderProcessingStack } from '../lib/order-processing-stack';

const app = new cdk.App();
new OrderProcessingStack(app, 'OrderProcessingStack', {
  /* Pinned to us-east-1 - Amazon Nova Lite supports on-demand throughput there directly,
   * avoiding the cross-region inference profile other regions (e.g. ap-southeast-1) require.
   * Account still follows the active CLI/profile so this isn't tied to one AWS account. */
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
