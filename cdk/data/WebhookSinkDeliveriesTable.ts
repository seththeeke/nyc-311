import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface WebhookSinkDeliveriesTableProps {
  envName: Nyc311Environment;
}

/**
 * The Test-only webhook sink's delivery records
 * (`13-customer-simulation.md` §5) — `webhook_id` as the sole key, rows
 * removed by TTL (`expires_at`) after a week. Disposable test bookkeeping,
 * so no point-in-time recovery and it is destroyed with the stack.
 */
export class WebhookSinkDeliveriesTable extends TableV2 {
  constructor(scope: Construct, id: string, props: WebhookSinkDeliveriesTableProps) {
    super(scope, id, {
      tableName: `WebhookSinkDeliveries-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "webhook_id", type: AttributeType.STRING },
      timeToLiveAttribute: "expires_at",
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
