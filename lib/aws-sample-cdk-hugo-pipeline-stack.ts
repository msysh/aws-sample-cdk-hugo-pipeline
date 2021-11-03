import * as cdk from '@aws-cdk/core';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as actions from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';

export class AwsSampleCdkHugoPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const PREFIX = this.node.tryGetContext('prefix');
    const HUGO_VERSION = this.node.tryGetContext('hugoVersion');

    // Tag
    cdk.Tags.of(this).add('project', 'hugo pipeline');

    // -----------------------------
    // S3 & CloudFront for contents
    // -----------------------------

    // S3 for Content Bucket
    const contentBucket = new s3.Bucket(this, `${PREFIX}-content-bucket`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 for Access Log Bucket
    const logBucket = new s3.Bucket(this, `${PREFIX}-log-bucket`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, `${PREFIX}-oai`);

    // Bucket policy
    const bucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [ 's3:GetObject' ],
      resources: [
        `${contentBucket.bucketArn}/*`
      ],
      principals: [
        new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)
      ]
    });
    contentBucket.addToResourcePolicy(bucketPolicy);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, `${PREFIX}-cloudfront-distribution`, {
      defaultBehavior: {
        origin: new origins.S3Origin(contentBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      defaultRootObject: 'index.html',
      enableLogging: true,
      logBucket: logBucket,
      // logFilePrefix: '',
      logIncludesCookies: false,
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/403.html',
          ttl: cdk.Duration.seconds(1)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.seconds(1)
        }
      ]
    });

    // -----------------------------
    // CodeCommit
    // -----------------------------
    const repository = new codecommit.Repository(this, `${PREFIX}-repository`, {
      repositoryName: `${PREFIX}-source`,
      description: 'Repository for hugo contents'
    });

    // -----------------------------
    // CodeBuild
    // -----------------------------
    const projectName = `${PREFIX}-build`;

    // LogGroup for CodeBuild
    const logGroup = new logs.LogGroup(this, `${PREFIX}-codebuild-logs`, {
      logGroupName: `/aws/codebuild/${projectName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.THREE_MONTHS
    });

    // IAM Policy for CodeBuild
    const buildSyncPolicyDocument = new iam.PolicyDocument({
      statements:[
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject'
          ],
          resources: [
            `${contentBucket.bucketArn}/*`
          ]
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListBucket'
          ],
          resources: [
            'arn:aws:s3:::*'
          ]
        })
      ]
    });
    // IAM Role for CodeBuild
    const buildRole = new iam.Role(this, `${PREFIX}-codebuild-role`, {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: 'Role for CodeBuild',
      inlinePolicies: {
        'policy': buildSyncPolicyDocument
      }
    });

    // BuildProject
    const buildProject = new codebuild.PipelineProject(this, `${PREFIX}-codebuild-project`, {
      projectName: projectName,
      // buildSpec: build.BuildSpec.fromSourceFilename('buildspec.yml')
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: "0.2",
        phases: {
          install: {
            commands: [
              "ls -la /tmp",
              "echo hugo version is ${HUGO_VERSION}",
              "curl -Ls https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_Linux-64bit.tar.gz -o /tmp/hugo.tar.gz",
              "tar zxf /tmp/hugo.tar.gz -C /tmp",
              "mv /tmp/hugo /usr/local/bin/hugo",
              "rm -rf /tmp/hugo*"
            ]
          },
          pre_build: {
            commands: [
              "git submodule update --init --recursive"
            ]
          },
          build: {
            commands: [
              "/usr/local/bin/hugo"
            ],
          },
          post_build: {
            commands: [
              "aws s3 sync --exact-timestamps --delete --exclude \"*.drawio\" ./public/ s3://${CONTENT_BUCKET}/"
            ]
          }
        },
        artifacts: {
          files: [ 'public/**/*' ],
          name: '${CODEBUILD_BUILD_ID#' + projectName + ':}'
        }
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
        computeType: codebuild.ComputeType.SMALL
      },
      environmentVariables: {
        "HUGO_VERSION": {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: HUGO_VERSION
        },
        "CONTENT_BUCKET": {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: contentBucket.bucketName
        }
      },
      logging: {
        cloudWatch: {
          logGroup: logGroup
        }
      },
      role: buildRole,
      timeout: cdk.Duration.minutes(5),
      queuedTimeout: cdk.Duration.hours(8)
    });

    // -----------------------------
    // CodePipeline
    // -----------------------------

    // S3 for CodePipeline ArtifactStore
    const artifactBucket = new s3.Bucket(this, `${PREFIX}-artifact-bucket`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // IAM Role for CodePipeline
    const pipelineRole = new iam.Role(this, `${PREFIX}-codepipeline-role`, {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
      description: 'Role for CodePipeline',
    });

    // Artifact for Source Output
    const sourceOutput = new codepipeline.Artifact('SourceOutput');

    // Artifact for Build Output
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // Source Action
    const sourceAction = new actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      branch: 'main',
      repository: repository,
      output: sourceOutput,
      codeBuildCloneOutput: true
    });

    // Build Action
    const buildAction = new actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: buildProject,
      input: sourceOutput,
      outputs: [ buildOutput ]
    });

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, `${PREFIX}-codepipeline`, {
      pipelineName: 'hugo-pipeline',
      artifactBucket: artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [ sourceAction ]
        },
        {
          stageName: 'Build',
          actions: [ buildAction ]
        }
      ],
      role: pipelineRole
    });

    // -----------------------------
    // Output
    // -----------------------------
    new cdk.CfnOutput(this, 'ArtifactBucketName', {
      value: artifactBucket.bucketName
    });
    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName
    });
    new cdk.CfnOutput(this, 'RepositoryHttpURL', {
      value: repository.repositoryCloneUrlHttp
    })
    new cdk.CfnOutput(this, 'SiteURL', {
      value: `https://${distribution.domainName}`
    });
  }
}
