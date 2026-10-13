import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX } from "./customerConfig";

/**
 * The customer's own row per order in play (`13-customer-simulation.md`,
 * decision 2026-10-13) — named for where it sits: the receiving end of
 * the webhook listener. `order_id` as the sole key, rows removed by TTL
 * (`expires_at`). Rebuildable from the bureau's replay script, so it is
 * destroyed with the stack rather than retained.
 */
export class WebhookCustomerFacingOrdersTable extends TableV2 {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tableName: `WebhookCustomerFacingOrders-${CUSTOMER_ENV_SUFFIX}`,
      partitionKey: { name: "order_id", type: AttributeType.STRING },
      timeToLiveAttribute: "expires_at",
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
