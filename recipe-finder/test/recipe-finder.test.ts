import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as RecipeFinder from '../lib/recipe-finder-stack';

test('S3 Vector Bucket and Bedrock Knowledge Base created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new RecipeFinder.RecipeFinderStack(app, 'MyTestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3Vectors::VectorBucket', {
    VectorBucketName: 'recipe-finder-vectors',
  });

  template.hasResourceProperties('AWS::Bedrock::KnowledgeBase', {
    Name: 'recipe-finder-kb',
  });
});
