import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WebhookSubscriptionsTable } from "../data/WebhookSubscriptionsTable";
import { WEBHOOK_ALLOWED_CALLBACK_HOSTS, WEBHOOK_SSM_PREFIX } from "./webhookConfig";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311RegisterWebhookSubscriptionApiLambdaProps {
  envName: Nyc311Environment;
  webhookSubscriptionsTable: WebhookSubscriptionsTable;
}

/**
 * Backs `POST /webhook-subscriptions` (`13-customer-simulation.md` §5) —
 * the one route a subscriber calls. It checks the hand-created
 * registration key itself (HTTP APIs have no native API keys), so this
 * route has no authorizer. Entry point is
 * `backend/controller/web-api/registerWebhookSubscriptionController.ts`.
 */
export class Nyc311RegisterWebhookSubscriptionApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311RegisterWebhookSubscriptionApiLambdaProps) {
    const functionName = `Nyc311RegisterWebhookSubscriptionApi-${ENV_NAME_SUFFIX[props.envName]}`;
    const ssmPrefix = WEBHOOK_SSM_PREFIX[props.envName];

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "registerWebhookSubscriptionController.ts"),
      handler: "registerWebhookSubscriptionController",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(10),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WEBHOOK_SUBSCRIPTIONS_TABLE_NAME: props.webhookSubscriptionsTable.tableName,
        WEBHOOK_SSM_PREFIX: ssmPrefix,
        WEBHOOK_ALLOWED_CALLBACK_HOSTS: WEBHOOK_ALLOWED_CALLBACK_HOSTS[props.envName].join(","),
      },
    });

    /* Least privilege: the capped Scan + a put; read the registration key; write (never read) subscription secrets. */
    props.webhookSubscriptionsTable.grant(this, "dynamodb:Scan", "dynamodb:PutItem");
    const parameterArn = (resourceName: string): string =>
      Stack.of(this).formatArn({ service: "ssm", resource: "parameter", resourceName: `${ssmPrefix.slice(1)}/${resourceName}` });
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["ssm:GetParameter"], resources: [parameterArn("registration-key")] }));
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["ssm:PutParameter"], resources: [parameterArn("*/secret")] }));
  }
}
