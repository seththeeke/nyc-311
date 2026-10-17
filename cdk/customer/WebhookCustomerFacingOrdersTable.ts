import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, type CfnGlobalTable, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX } from "./customerConfig";

/**
 * The customer's own row per order in play (`13-customer-simulation.md`,
 * decision 2026-10-13) — named for where it sits: the receiving end of
 * the webhook listener. `order_id` as the sole key. Rows never expire
 * (decision 6, 2026-10-17): ideas reference orders by id. The sparse
 * `OpenByBorough` index holds only open orders, at a random `pick_key`,
 * so the idea worker samples fairly (decision 5). Rebuildable from
 * the bureau's replay script, so it is destroyed with the stack rather
 * than retained.
 */
export class WebhookCustomerFacingOrdersTable extends TableV2 {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tableName: `WebhookCustomerFacingOrders-${CUSTOMER_ENV_SUFFIX}`,
      partitionKey: { name: "order_id", type: AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: "OpenByBorough",
          partitionKey: { name: "open_borough", type: AttributeType.STRING },
          sortKey: { name: "pick_key", type: AttributeType.STRING },
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
    });
    /* Explicitly off, not just omitted: rows written before 2026-10-17 still carry `expires_at`. */
    (this.node.defaultChild as CfnGlobalTable).timeToLiveSpecification = { attributeName: "expires_at", enabled: false };
  }
}
