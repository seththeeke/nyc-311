import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { CUSTOMER_ENV_SUFFIX } from "./customerConfig";

/**
 * `Residents` (`13-customer-simulation.md` §2 customer side, decisions 1
 * and 9): partition `persona_id`, sort `sk` — `CURRENT` plus an immutable
 * `V#nnnn` per version. The sparse `Roster` index (only CURRENT rows carry
 * `roster_pk`) lists residents without a scan. Retained: the counters and
 * version history are not rebuildable from the seeds.
 */
export class ResidentsTable extends TableV2 {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      tableName: `Residents-${CUSTOMER_ENV_SUFFIX}`,
      partitionKey: { name: "persona_id", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: "Roster",
          partitionKey: { name: "roster_pk", type: AttributeType.STRING },
          sortKey: { name: "persona_id", type: AttributeType.STRING },
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
