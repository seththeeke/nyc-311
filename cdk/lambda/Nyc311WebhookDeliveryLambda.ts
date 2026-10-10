import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WebhookSubscriptionsTable } from "../data/WebhookSubscriptionsTable";
import type { Nyc311WebhookDeliveryQueue } from "./Nyc311WebhookDeliveryQueue";
import { WEBHOOK_SSM_PREFIX } from "./webhookConfig";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WebhookDeliveryLambdaProps {
  envName: Nyc311Environment;
  webhookSubscriptionsTable: WebhookSubscriptionsTable;
  webhookDeliveryQueue: Nyc311WebhookDeliveryQueue;
}

/* At most this many POSTs in flight, so a backlog (a backfill, a redrive, a replay) can't flood a subscriber. SQS's minimum. */
export const WEBHOOK_DELIVERY_MAX_CONCURRENCY = 2;

/**
 * Signs and POSTs one webhook delivery per message
 * (`13-customer-simulation.md` §3 Flow A). One message per invocation, so
 * a slow subscriber holds up nothing else; a failure is left to the
 * queue's redrive policy. Entry point is
 * `backend/controller/webhook/deliverWebhookController.ts`.
 */
export class Nyc311WebhookDeliveryLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WebhookDeliveryLambdaProps) {
    const functionName = `Nyc311WebhookDelivery-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "webhook", "deliverWebhookController.ts"),
      handler: "deliverWebhookController",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      /* The POST itself times out at 10s (backend's WEBHOOK_DELIVERY_TIMEOUT_MS); the rest is a GetItem and an SSM read. */
      timeout: Duration.seconds(20),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WEBHOOK_SUBSCRIPTIONS_TABLE_NAME: props.webhookSubscriptionsTable.tableName,
      },
    });

    this.addEventSource(
      new SqsEventSource(props.webhookDeliveryQueue.queue, {
        batchSize: 1,
        maxConcurrency: WEBHOOK_DELIVERY_MAX_CONCURRENCY,
        reportBatchItemFailures: true,
      })
    );

    /* Least privilege: re-read one subscription, and read (never write) subscription secrets — not the registration key. */
    props.webhookSubscriptionsTable.grant(this, "dynamodb:GetItem");
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          Stack.of(this).formatArn({
            service: "ssm",
            resource: "parameter",
            resourceName: `${WEBHOOK_SSM_PREFIX[props.envName].slice(1)}/*/secret`,
          }),
        ],
      })
    );
  }
}
