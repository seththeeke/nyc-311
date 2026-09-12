import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, ProjectionType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface OperatorsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `Operator`/`OperatorEvent` (`data-model.md#operator`, simplified
 * for v1 per `10-capacity-modeling-and-integration.md` §1.1/§1.4) —
 * `operator_id` + `sk` (`#METADATA`/`EVENT#<n>`), same event-sourced shape
 * as `OrdersTable`.
 *
 * No stream yet — the all-time cost computation (§2.3) is a future
 * warehouse-job consumer not built in this leg; adding the stream then is
 * a non-replacing table update, same as it was for `Locations`/`Requests`.
 */
export class OperatorsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: OperatorsTableProps) {
    super(scope, id, {
      tableName: `Operators-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "operator_id", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: "gsi1-availability",
          /*
           * Intended access pattern: the real CapacityAvailabilityProvider
           * (Leg 1.5, not yet wired in) — Query gsi1pk = "AVAILABLE",
           * oldest-idle-first. Sparse — only set while ACTIVE + IDLE +
           * no removal requested.
           */
          partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
          sortKey: { name: "gsi1sk", type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
        {
          indexName: "gsi2-roster",
          /*
           * Intended access pattern: GET /capacity's live roster (Query
           * gsi2pk = "OPERATOR", gsi2sk begins_with "ACTIVE#") and the
           * future all-time cost job's unfiltered fold over every
           * Operator ever.
           */
          partitionKey: { name: "gsi2pk", type: AttributeType.STRING },
          sortKey: { name: "gsi2sk", type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
      ],
    });
  }
}
