import * as cdk from '@aws-cdk/core';
import * as cloudfront from '@aws-cdk/aws-cloudfront';

export class CloudFrontFunctionsStack extends cdk.Stack {

    public readonly stackProps: CloudFrontFunctionsStackProps;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Tag
        cdk.Tags.of(this).add('project', 'hugo pipeline');

        // -----------------------------
        // CloudFront Functions
        // -----------------------------
        const cfFunction = new cloudfront.Function(this, "cloudfront-function", {
            functionName: `append-index`,
            code: cloudfront.FunctionCode.fromFile({
                filePath: "cf-functions/append-index/index.js",
            }),
            comment: 'appends index.html to requests that don’t include a file name or extension in the URL.'
        });

        this.stackProps = { appendIndexCfFunction: cfFunction } as CloudFrontFunctionsStackProps;
    }
}

export interface CloudFrontFunctionsStackProps extends cdk.StackProps {
    appendIndexCfFunction: cloudfront.Function;
}