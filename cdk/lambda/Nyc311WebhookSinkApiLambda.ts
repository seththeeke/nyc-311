import { Duration, Stack } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { WebhookSinkDeliveriesTable } from "../data/WebhookSinkDeliveriesTable";
import { WEBHOOK_SINK_SECRET_PARAMETER_NAME } from "./webhookConfig";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311WebhookSinkApiLambdaProps {
  envName: Nyc311Environment;
  webhookSinkDeliveriesTable: WebhookSinkDeliveriesTable;
}

/**
 * The webhookSink Service API bundle (`15-resource-consolidation.md`
 * §3.3), Test only: the sink's receive and list routes
 * (`13-customer-simulation.md` §5), entry
 * `backend/controller/web-api/webhookSink/webhookSinkApiRouter.ts`.
 */
export class Nyc311WebhookSinkApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311WebhookSinkApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311WebhookSinkApi",
      entry: ["controller", "web-api", "webhookSink", "webhookSinkApiRouter.ts"],
      handler: "webhookSinkApiRouter",
      timeout: Duration.seconds(10),
      memorySize: 512,
      environment: {
        WEBHOOK_SINK_DELIVERIES_TABLE_NAME: props.webhookSinkDeliveriesTable.tableName,
        WEBHOOK_SINK_SECRET_PARAMETER_NAME,
      },
    });

    props.webhookSinkDeliveriesTable.grant(this, "dynamodb:PutItem", "dynamodb:Scan");
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [Stack.of(this).formatArn({ service: "ssm", resource: "parameter", resourceName: WEBHOOK_SINK_SECRET_PARAMETER_NAME.slice(1) })],
      })
    );
  }
}
