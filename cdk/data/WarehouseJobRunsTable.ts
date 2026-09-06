import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, ProjectionType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface WarehouseJobRunsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `WarehouseJobRun` (`7-data-warehousing.md` §9) — a plain per-run
 * history record, not event-sourced. `gsi1-recent-runs` (`gsi1pk` =
 * `JOB#RUNS`, `gsi1sk` = `started_at`) backs `/data`'s most-recent-first
 * view; `gsi2-status` (`gsi2pk` = `status`, `gsi2sk` = `started_at`) backs
 * the retry sweep.
 */
export class WarehouseJobRunsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: WarehouseJobRunsTableProps) {
    super(scope, id, {
      tableName: `WarehouseJobRuns-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "job_run_id", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: "gsi1-recent-runs",
          partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
          sortKey: { name: "gsi1sk", type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
        {
          indexName: "gsi2-status",
          partitionKey: { name: "gsi2pk", type: AttributeType.STRING },
          sortKey: { name: "gsi2sk", type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
      ],
    });
  }
}
