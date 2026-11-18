import { Duration, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { WebhookSubscriptionsTable } from "../data/WebhookSubscriptionsTable";
import { WEBHOOK_ALLOWED_CALLBACK_HOSTS, WEBHOOK_SSM_PREFIX } from "./webhookConfig";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311WebhookSubscriptionsApiLambdaProps {
  envName: Nyc311Environment;
  webhookSubscriptionsTable: WebhookSubscriptionsTable;
}

/**
 * Backs `POST /webhook-subscriptions` (`13-customer-simulation.md` §5) —
 * the one route a subscriber calls. It checks the hand-created
 * registration key itself (HTTP APIs have no native API keys), so this
 * route has no authorizer. Entry point is
 * `backend/controller/web-api/webhookSubscriptions/webhookSubscriptionsApiRouter.ts`,
 * the webhookSubscriptions Service API bundle (`15-resource-consolidation.md`
 * §3.3). Keeps its pre-bundle function name, so the cutover replaced no resource.
 */
export class Nyc311WebhookSubscriptionsApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311WebhookSubscriptionsApiLambdaProps) {
    const ssmPrefix = WEBHOOK_SSM_PREFIX[props.envName];

    super(scope, id, {
      envName: props.envName,
      name: "Nyc311RegisterWebhookSubscriptionApi",
      entry: ["controller", "web-api", "webhookSubscriptions", "webhookSubscriptionsApiRouter.ts"],
      handler: "webhookSubscriptionsApiRouter",
      timeout: Duration.seconds(10),
      memorySize: 512,
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
