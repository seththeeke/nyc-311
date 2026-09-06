import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface AnalyticsRollupsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `AnalyticsRollup` (`7-data-warehousing.md` §11) — the sample
 * job's pre-aggregated output. `metric_view` (PK) + `rollup_key` (SK,
 * `<run_date>#<dimension>`); every `/data` read is a single
 * `Query metric_view = :mv` newest-first, so no GSI.
 */
export class AnalyticsRollupsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: AnalyticsRollupsTableProps) {
    super(scope, id, {
      tableName: `AnalyticsRollups-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "metric_view", type: AttributeType.STRING },
      sortKey: { name: "rollup_key", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
