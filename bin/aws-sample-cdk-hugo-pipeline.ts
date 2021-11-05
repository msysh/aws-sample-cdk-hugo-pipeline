#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { HugoPipelineStack } from '../lib/hugo-pipeline-stack';
import { CloudFrontFunctionsStack } from '../lib/cloudfront-functions-stack';

const app = new cdk.App();
const cfFunctionsStack = new CloudFrontFunctionsStack(app, 'HugoPipeline-CloudFrontFunctionsStack');
new HugoPipelineStack(app, 'HugoPipelineStack', {
    appendIndexCfFunction: cfFunctionsStack.stackProps.appendIndexCfFunction
});
