import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as HugoPipeline from '../lib/hugo-pipeline-stack';
import * as CloudFrontFunctionsStack from '../lib/cloudfront-functions-stack';

test('Empty Stack', () => {
  /*
    const app = new cdk.App();
    // WHEN
    const cffStack = new CloudFrontFunctionsStack.CloudFrontFunctionsStack(app, 'MyCloudFrontFunctionsStack');
    const stack = new HugoPipeline.HugoPipelineStack(app, 'MyTestStack', { appendIndexCfFunction: cffStack.stackProps.appendIndexCfFunction });
    // THEN
    expectCDK(cffStack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT));
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT));
  */
});
