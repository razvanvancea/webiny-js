import path from "path";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// @ts-ignore
import { getLayerArn } from "@webiny/aws-layers";
import { createAppModule, PulumiApp, PulumiAppModule } from "@webiny/pulumi";

import { createLambdaRole, getCommonLambdaEnvVariables } from "../lambdaUtils";
import { CoreOutput, VpcConfig } from "../common";

export type ApiFileManager = PulumiAppModule<typeof ApiFileManager>;

export const ApiFileManager = createAppModule({
    name: "ApiFileManager",
    config(app: PulumiApp) {
        const core = app.getModule(CoreOutput);

        const policy = createFileManagerLambdaPolicy(app);
        const role = createLambdaRole(app, {
            name: "fm-lambda-role",
            policy: policy.output
        });

        const transform = app.addResource(aws.lambda.Function, {
            name: "fm-image-transformer",
            config: {
                handler: "handler.handler",
                timeout: 30,
                runtime: "nodejs14.x",
                memorySize: 1600,
                role: role.output.arn,
                description: "Performs image optimization, resizing, etc.",
                code: new pulumi.asset.AssetArchive({
                    ".": new pulumi.asset.FileArchive(
                        path.join(app.paths.workspace, "fileManager/transform/build")
                    )
                }),
                layers: [getLayerArn("sharp")],
                environment: {
                    variables: {
                        ...getCommonLambdaEnvVariables(),
                        S3_BUCKET: core.fileManagerBucketId
                    }
                },
                vpcConfig: app.getModule(VpcConfig).functionVpcConfig
            }
        });

        const manage = app.addResource(aws.lambda.Function, {
            name: "fm-manage",
            config: {
                role: role.output.arn,
                runtime: "nodejs14.x",
                handler: "handler.handler",
                timeout: 30,
                memorySize: 512,
                description: "Triggered when a file is deleted.",
                code: new pulumi.asset.AssetArchive({
                    ".": new pulumi.asset.FileArchive(
                        path.join(app.paths.workspace, "fileManager/manage/build")
                    )
                }),
                environment: {
                    variables: {
                        ...getCommonLambdaEnvVariables(),
                        S3_BUCKET: core.fileManagerBucketId
                    }
                },
                vpcConfig: app.getModule(VpcConfig).functionVpcConfig
            }
        });

        const download = app.addResource(aws.lambda.Function, {
            name: "fm-download",
            config: {
                role: role.output.arn,
                runtime: "nodejs14.x",
                handler: "handler.handler",
                timeout: 30,
                memorySize: 512,
                description: "Serves previously uploaded files.",
                code: new pulumi.asset.AssetArchive({
                    ".": new pulumi.asset.FileArchive(
                        path.join(app.paths.workspace, "fileManager/download/build")
                    )
                }),
                environment: {
                    variables: {
                        ...getCommonLambdaEnvVariables(),
                        S3_BUCKET: core.fileManagerBucketId,
                        IMAGE_TRANSFORMER_FUNCTION: transform.output.arn
                    }
                },
                vpcConfig: app.getModule(VpcConfig).functionVpcConfig
            }
        });

        const manageS3LambdaPermission = app.addResource(aws.lambda.Permission, {
            name: "fm-manage-s3-lambda-permission",
            config: {
                action: "lambda:InvokeFunction",
                function: manage.output.arn,
                principal: "s3.amazonaws.com",
                sourceArn: pulumi.interpolate`arn:aws:s3:::${core.fileManagerBucketId}`
            },
            opts: {
                dependsOn: [manage.output]
            }
        });

        const bucketNotification = app.addResource(aws.s3.BucketNotification, {
            name: "bucketNotification",
            config: {
                bucket: core.fileManagerBucketId,
                lambdaFunctions: [
                    {
                        lambdaFunctionArn: manage.output.arn,
                        events: ["s3:ObjectRemoved:*"]
                    }
                ]
            },
            opts: {
                dependsOn: [manage.output, manageS3LambdaPermission.output]
            }
        });

        const functions = {
            transform,
            manage,
            download
        };

        return {
            functions,
            bucketNotification
        };
    }
});

function createFileManagerLambdaPolicy(app: PulumiApp) {
    const core = app.getModule(CoreOutput);

    return app.addResource(aws.iam.Policy, {
        name: "FileManagerLambdaPolicy",
        config: {
            description: "This policy enables access to Lambda and S3",
            policy: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Sid: "PermissionForLambda",
                        Effect: "Allow",
                        Action: "lambda:InvokeFunction",
                        Resource: "*"
                    },
                    {
                        Sid: "PermissionForS3",
                        Effect: "Allow",
                        Action: "s3:*",
                        Resource: pulumi.interpolate`arn:aws:s3:::${core.fileManagerBucketId}/*`
                    }
                ]
            }
        }
    });
}
