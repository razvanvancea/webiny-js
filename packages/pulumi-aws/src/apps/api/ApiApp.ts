import {
    defineApp,
    createGenericApplication,
    ApplicationConfig,
    ApplicationContext
} from "@webiny/pulumi-sdk";
import { updateGatewayConfig } from "@webiny/pulumi-sdk";

import { StorageOutput, VpcConfig } from "../common";
import { ApiGraphql } from "./ApiGraphql";
import { ApiFileManager } from "./ApiFileManager";
import { ApiPageBuilder } from "./ApiPageBuilder";
import { ApiHeadlessCMS } from "./ApiHeadlessCMS";
import { ApiGateway } from "./ApiGateway";
import { ApiCloudfront } from "./ApiCloudfront";
import { ApiApwScheduler } from "./ApiApwScheduler";
import { applyCustomDomain, CustomDomainParams } from "../customDomain";
import { AppInput, getAppInput } from "../utils";

export interface ApiAppConfig {
    /**
     * Enables or disables VPC for the API.
     * For VPC to work you also have to enable it in the `storage` application.
     */
    vpc?: AppInput<boolean | undefined>;
    /** Custom domain configuration */
    domain?(ctx: ApplicationContext): CustomDomainParams | undefined | void;
}

export const ApiApp = defineApp({
    name: "Api",
    async config(app, config: ApiAppConfig) {
        // Enables logs forwarding.
        // https://www.webiny.com/docs/how-to-guides/use-watch-command#enabling-logs-forwarding
        const WEBINY_LOGS_FORWARD_URL = String(process.env.WEBINY_LOGS_FORWARD_URL);

        // Register storage output as a module available for all other modules
        const storage = app.addModule(StorageOutput);

        // Register VPC config module to be available to other modules
        app.addModule(VpcConfig, {
            enabled: getAppInput(app, config.vpc)
        });

        const pageBuilder = app.addModule(ApiPageBuilder, {
            env: {
                COGNITO_REGION: String(process.env.AWS_REGION),
                COGNITO_USER_POOL_ID: storage.cognitoUserPoolId,
                DB_TABLE: storage.primaryDynamodbTableName,
                DB_TABLE_ELASTICSEARCH: storage.elasticsearchDynamodbTableName,
                ELASTIC_SEARCH_ENDPOINT: storage.elasticsearchDomainEndpoint,

                // Not required. Useful for testing purposes / ephemeral environments.
                // https://www.webiny.com/docs/key-topics/ci-cd/testing/slow-ephemeral-environments
                ELASTIC_SEARCH_INDEX_PREFIX: process.env.ELASTIC_SEARCH_INDEX_PREFIX,

                S3_BUCKET: storage.fileManagerBucketId,
                WEBINY_LOGS_FORWARD_URL
            }
        });

        const fileManager = app.addModule(ApiFileManager);

        const apwScheduler = app.addModule(ApiApwScheduler, {
            primaryDynamodbTableArn: storage.primaryDynamodbTableArn,

            env: {
                COGNITO_REGION: String(process.env.AWS_REGION),
                COGNITO_USER_POOL_ID: storage.cognitoUserPoolId,
                DB_TABLE: storage.primaryDynamodbTableName,
                S3_BUCKET: storage.fileManagerBucketId,
                WEBINY_LOGS_FORWARD_URL
            }
        });

        const graphql = app.addModule(ApiGraphql, {
            env: {
                COGNITO_REGION: String(process.env.AWS_REGION),
                COGNITO_USER_POOL_ID: storage.cognitoUserPoolId,
                DB_TABLE: storage.primaryDynamodbTableName,
                DB_TABLE_ELASTICSEARCH: storage.elasticsearchDynamodbTableName,
                ELASTIC_SEARCH_ENDPOINT: storage.elasticsearchDomainEndpoint,

                // Not required. Useful for testing purposes / ephemeral environments.
                // https://www.webiny.com/docs/key-topics/ci-cd/testing/slow-ephemeral-environments
                ELASTIC_SEARCH_INDEX_PREFIX: process.env.ELASTIC_SEARCH_INDEX_PREFIX,

                S3_BUCKET: storage.fileManagerBucketId,
                EVENT_BUS: storage.eventBusArn,
                IMPORT_PAGES_CREATE_HANDLER: pageBuilder.importPages.functions.create.output.arn,
                EXPORT_PAGES_PROCESS_HANDLER: pageBuilder.exportPages.functions.process.output.arn,
                // TODO: move to okta plugin
                OKTA_ISSUER: process.env["OKTA_ISSUER"],
                WEBINY_LOGS_FORWARD_URL
            },
            apwSchedulerEventRule: apwScheduler.eventRule.output,
            apwSchedulerEventTarget: apwScheduler.eventTarget.output
        });

        const headlessCms = app.addModule(ApiHeadlessCMS, {
            env: {
                COGNITO_REGION: String(process.env.AWS_REGION),
                COGNITO_USER_POOL_ID: storage.cognitoUserPoolId,
                DB_TABLE: storage.primaryDynamodbTableName,
                DB_TABLE_ELASTICSEARCH: storage.elasticsearchDynamodbTableName,
                ELASTIC_SEARCH_ENDPOINT: storage.elasticsearchDomainEndpoint,

                // Not required. Useful for testing purposes / ephemeral environments.
                // https://www.webiny.com/docs/key-topics/ci-cd/testing/slow-ephemeral-environments
                ELASTIC_SEARCH_INDEX_PREFIX: process.env.ELASTIC_SEARCH_INDEX_PREFIX,

                S3_BUCKET: storage.fileManagerBucketId,
                // TODO: move to okta plugin
                OKTA_ISSUER: process.env["OKTA_ISSUER"],
                WEBINY_LOGS_FORWARD_URL
            }
        });

        const apiGateway = app.addModule(ApiGateway, {
            "graphql-post": {
                path: "/graphql",
                method: "POST",
                function: graphql.functions.graphql.output.arn
            },
            "graphql-options": {
                path: "/graphql",
                method: "OPTIONS",
                function: graphql.functions.graphql.output.arn
            },
            "files-any": {
                path: "/files/{path}",
                method: "ANY",
                function: fileManager.functions.download.output.arn
            },
            "cms-post": {
                path: "/cms/{key+}",
                method: "POST",
                function: headlessCms.functions.graphql.output.arn
            },
            "cms-options": {
                path: "/cms/{key+}",
                method: "OPTIONS",
                function: headlessCms.functions.graphql.output.arn
            }
        });

        const cloudfront = app.addModule(ApiCloudfront);

        const domain = config.domain?.(app.ctx);
        if (domain) {
            applyCustomDomain(cloudfront, domain);
        }

        app.addOutputs({
            region: process.env.AWS_REGION,
            apiUrl: cloudfront.output.domainName.apply(value => `https://${value}`),
            apiDomain: cloudfront.output.domainName,
            cognitoUserPoolId: storage.cognitoUserPoolId,
            cognitoAppClientId: storage.cognitoAppClientId,
            cognitoUserPoolPasswordPolicy: storage.cognitoUserPoolPasswordPolicy,
            apwSchedulerScheduleAction: apwScheduler.scheduleAction.lambda.output.arn,
            apwSchedulerExecuteAction: apwScheduler.executeAction.lambda.output.arn,
            apwSchedulerEventRule: apwScheduler.eventRule.output.name,
            apwSchedulerEventTargetId: apwScheduler.eventTarget.output.targetId,
            dynamoDbTable: storage.primaryDynamodbTableName,
            dynamoDbElasticsearchTable: storage.elasticsearchDynamodbTableName
        });

        // Update variant gateway configuration.
        const variant = app.ctx.variant;
        if (variant) {
            app.onAfterDeploy(async ({ outputs }) => {
                // After deployment is made we update a static JSON file with a variant configuration.
                // TODO: We should update WCP config instead of a static file here
                await updateGatewayConfig({
                    app: "api",
                    cwd: app.ctx.projectDir,
                    env: app.ctx.env,
                    variant: variant,
                    domain: outputs["apiDomain"]
                });
            });
        }

        return {
            fileManager,
            graphql,
            headlessCms,
            apiGateway,
            cloudfront,
            apwScheduler
        };
    }
});

export type ApiApp = InstanceType<typeof ApiApp>;

export function createApiApp(config?: ApiAppConfig & ApplicationConfig<ApiApp>) {
    return createGenericApplication({
        id: "api",
        name: "api",
        description:
            "Represents cloud infrastructure needed for supporting your project's (GraphQL) API.",
        cli: {
            // Default args for the "yarn webiny watch ..." command.
            watch: {
                // Watch five levels of dependencies, starting from this project application.
                depth: 5
            }
        },
        async app(ctx) {
            // Create the app instance.
            const app = new ApiApp(ctx);
            // Run the default application setup.
            await app.setup(config || {});
            // Run the custom user config.
            await config?.config?.(app, ctx);
            return app;
        },
        onBeforeBuild: config?.onBeforeBuild,
        onAfterBuild: config?.onAfterBuild,
        onBeforeDeploy: config?.onBeforeDeploy,
        onAfterDeploy: config?.onAfterDeploy
    });
}
