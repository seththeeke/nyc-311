import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface LiveWorkspaceMetricsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs the secondary workspace's live (week-to-date) metric tiles —
 * `metric_key` as the sole key: one `DAY#<date>` counter bucket per New
 * York day, plus a `SEEN#` marker per counted Order event that
 * `expires_at` (TTL) removes after 30 days. No GSIs (the read is a
 * 14-key BatchGetItem), no stream.
 */
export class LiveWorkspaceMetricsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: LiveWorkspaceMetricsTableProps) {
    super(scope, id, {
      tableName: `LiveWorkspaceMetrics-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "metric_key", type: AttributeType.STRING },
      timeToLiveAttribute: "expires_at",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: props.envName === "PROD", /* v1-prod-deployment.md B9; Test stays deletable */
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
