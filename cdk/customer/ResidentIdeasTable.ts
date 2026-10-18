import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX } from "./customerConfig";

/**
 * `ResidentIdeas` (`13-customer-simulation.md` §2 customer side,
 * decisions 4 and 9): partition `persona_id`, sort `sk` — `IDEA#<ulid>`
 * per idea and `ORDER#<order_id>` per thread. `ByOrder` (sparse, ideas
 * about an order) and `Feed` (every idea) both sort on `idea_id`. No TTL,
 * and retained: ideas are the simulation's history.
 */
export class ResidentIdeasTable extends TableV2 {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tableName: `ResidentIdeas-${CUSTOMER_ENV_SUFFIX}`,
      partitionKey: { name: "persona_id", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: "ByOrder",
          partitionKey: { name: "by_order_pk", type: AttributeType.STRING },
          sortKey: { name: "idea_id", type: AttributeType.STRING },
        },
        {
          indexName: "Feed",
          partitionKey: { name: "feed_pk", type: AttributeType.STRING },
          sortKey: { name: "idea_id", type: AttributeType.STRING },
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
