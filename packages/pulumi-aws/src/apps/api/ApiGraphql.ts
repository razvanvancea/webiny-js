import path from "path";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import { createAppModule, PulumiApp, PulumiAppModule } from "@webiny/pulumi";
import { createLambdaRole, getCommonLambdaEnvVariables } from "../lambdaUtils";
import { CoreOutput, VpcConfig } from "~/apps";
import { getAwsAccountId, getAwsRegion } from "../awsUtils";

interface GraphqlParams {
    env: Record<string, any>;
    apwSchedulerEventRule: pulumi.Output<aws.cloudwatch.EventRule>;
    apwSchedulerEventTarget: pulumi.Output<aws.cloudwatch.EventTarget>;
}

export type ApiGraphql = PulumiAppModule<typeof ApiGraphql>;

export const ApiGraphql = createAppModule({
    name: "ApiGraphql",
    config(app: PulumiApp, params: GraphqlParams) {
        const core = app.getModule(CoreOutput);

        const policy = createGraphqlLambdaPolicy(app);
        const role = createLambdaRole(app, {
            name: "api-lambda-role",
            policy: policy.output
        });

        const graphql = app.addResource(aws.lambda.Function, {
            name: "graphql",
            config: {
                runtime: "nodejs14.x",
                handler: "handler.handler",
                role: role.output.arn,
                timeout: 30,
                memorySize: 512,
                code: new pulumi.asset.AssetArchive({
                    ".": new pulumi.asset.FileArchive(
                        path.join(app.paths.workspace, "graphql/build")
                    )
                }),
                environment: {
                    variables: {
                        ...getCommonLambdaEnvVariables(),
                        ...params.env,
                        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"
                    }
                },
                vpcConfig: app.getModule(VpcConfig).functionVpcConfig
            }
        });

        /**
         * Store meta information like "mainGraphqlFunctionArn" in APW settings at deploy time.
         *
         * Note: We can't pass "mainGraphqlFunctionArn" as env variable due to circular dependency between
         * "graphql" lambda and "api-apw-scheduler-execute-action" lambda.
         */
        app.addResource(aws.dynamodb.TableItem, {
            name: "apwSettings",
            config: {
                tableName: core.primaryDynamodbTableName,
                hashKey: core.primaryDynamodbTableHashKey,
                rangeKey: pulumi
                    .output(core.primaryDynamodbTableRangeKey)
                    .apply(key => key || "SK"),
                item: pulumi.interpolate`{
              "PK": {"S": "APW#SETTINGS"},
              "SK": {"S": "${app.params.run.variant || "A"}"},
              "mainGraphqlFunctionArn": {"S": "${graphql.output.arn}"},
              "eventRuleName": {"S": "${params.apwSchedulerEventRule.name}"},
              "eventTargetId": {"S": "${params.apwSchedulerEventTarget.targetId}"}
            }`
            }
        });

        return {
            role,
            policy,
            functions: {
                graphql
            }
        };
    }
});

function createGraphqlLambdaPolicy(app: PulumiApp) {
    const coreOutput = app.getModule(CoreOutput);
    const awsAccountId = getAwsAccountId(app);
    const awsRegion = getAwsRegion(app);

    return app.addResource(aws.iam.Policy, {
        name: "ApiGraphqlLambdaPolicy",
        config: {
            description: "This policy enables access to Dynamodb, S3, Lambda and Cognito IDP",
            // Core is pulumi.Output, so we need to run apply() to resolve policy based on it
            policy: coreOutput.apply(core => {
                const policy: aws.iam.PolicyDocument = {
                    Version: "2012-10-17",
                    Statement: [
                        {
                            Sid: "PermissionForDynamodb",
                            Effect: "Allow",
                            Action: [
                                "dynamodb:BatchGetItem",
                                "dynamodb:BatchWriteItem",
                                "dynamodb:ConditionCheckItem",
                                "dynamodb:CreateBackup",
                                "dynamodb:CreateTable",
                                "dynamodb:CreateTableReplica",
                                "dynamodb:DeleteBackup",
                                "dynamodb:DeleteItem",
                                "dynamodb:DeleteTable",
                                "dynamodb:DeleteTableReplica",
                                "dynamodb:DescribeBackup",
                                "dynamodb:DescribeContinuousBackups",
                                "dynamodb:DescribeContributorInsights",
                                "dynamodb:DescribeExport",
                                "dynamodb:DescribeKinesisStreamingDestination",
                                "dynamodb:DescribeLimits",
                                "dynamodb:DescribeReservedCapacity",
                                "dynamodb:DescribeReservedCapacityOfferings",
                                "dynamodb:DescribeStream",
                                "dynamodb:DescribeTable",
                                "dynamodb:DescribeTableReplicaAutoScaling",
                                "dynamodb:DescribeTimeToLive",
                                "dynamodb:DisableKinesisStreamingDestination",
                                "dynamodb:EnableKinesisStreamingDestination",
                                "dynamodb:ExportTableToPointInTime",
                                "dynamodb:GetItem",
                                "dynamodb:GetRecords",
                                "dynamodb:GetShardIterator",
                                "dynamodb:ListBackups",
                                "dynamodb:ListContributorInsights",
                                "dynamodb:ListExports",
                                "dynamodb:ListStreams",
                                "dynamodb:ListTables",
                                "dynamodb:ListTagsOfResource",
                                "dynamodb:PartiQLDelete",
                                "dynamodb:PartiQLInsert",
                                "dynamodb:PartiQLSelect",
                                "dynamodb:PartiQLUpdate",
                                "dynamodb:PurchaseReservedCapacityOfferings",
                                "dynamodb:PutItem",
                                "dynamodb:Query",
                                "dynamodb:RestoreTableFromBackup",
                                "dynamodb:RestoreTableToPointInTime",
                                "dynamodb:Scan",
                                "dynamodb:UpdateContinuousBackups",
                                "dynamodb:UpdateContributorInsights",
                                "dynamodb:UpdateItem",
                                "dynamodb:UpdateTable",
                                "dynamodb:UpdateTableReplicaAutoScaling",
                                "dynamodb:UpdateTimeToLive"
                            ],
                            Resource: [
                                `${core.primaryDynamodbTableArn}`,
                                `${core.primaryDynamodbTableArn}/*`,
                                // Attach permissions for elastic search dynamo as well (if ES is enabled).
                                ...(core.elasticsearchDynamodbTableArn
                                    ? [
                                          `${core.elasticsearchDynamodbTableArn}`,
                                          `${core.elasticsearchDynamodbTableArn}/*`
                                      ]
                                    : [])
                            ]
                        },
                        {
                            Sid: "PermissionForS3",
                            Effect: "Allow",
                            Action: [
                                "s3:GetObjectAcl",
                                "s3:DeleteObject",
                                "s3:PutObjectAcl",
                                "s3:PutObject",
                                "s3:GetObject"
                            ],
                            Resource: `arn:aws:s3:::${core.fileManagerBucketId}/*`
                        },
                        {
                            Sid: "PermissionForLambda",
                            Effect: "Allow",
                            Action: ["lambda:InvokeFunction"],
                            Resource: pulumi.interpolate`arn:aws:lambda:${awsRegion}:${awsAccountId}:function:*`
                        },
                        {
                            Sid: "PermissionForCognitoIdp",
                            Effect: "Allow",
                            Action: "cognito-idp:*",
                            Resource: `${core.cognitoUserPoolArn}`
                        },
                        {
                            Sid: "PermissionForEventBus",
                            Effect: "Allow",
                            Action: "events:PutEvents",
                            Resource: core.eventBusArn
                        },
                        // Attach permissions for elastic search domain as well (if ES is enabled).
                        ...(core.elasticsearchDomainArn
                            ? [
                                  {
                                      Sid: "PermissionForES",
                                      Effect: "Allow" as const,
                                      Action: "es:*",
                                      Resource: [
                                          `${core.elasticsearchDomainArn}`,
                                          `${core.elasticsearchDomainArn}/*`
                                      ]
                                  }
                              ]
                            : [])
                    ]
                };

                return policy;
            })
        }
    });
}
