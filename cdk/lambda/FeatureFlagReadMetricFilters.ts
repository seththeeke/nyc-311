import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export const FEATURE_FLAG_METRIC_NAMESPACE = "Nyc311/FeatureFlags";

export interface FeatureFlagReadMetricFiltersProps {
  /** The calling Lambda's log group, where `featureFlagService.getTreatment` writes its `FeatureFlagRead` lines. */
  logGroup: logs.ILogGroup;
}

/* Dimensions every filter carries: the function names end in -Test/-Prod, which keeps the environments apart. */
const DIMENSIONS = { FunctionName: "$.functionName", FlagKey: "$.flagKey" };

/**
 * The backend flag read's metrics (#202 spec §3): success and fallback
 * counts plus the read's duration, from the one `FeatureFlagRead` log
 * line. A Lambda that calls `getTreatment` attaches this to its log group.
 */
export class FeatureFlagReadMetricFilters extends Construct {
  constructor(scope: Construct, id: string, props: FeatureFlagReadMetricFiltersProps) {
    super(scope, id);
    this.addFilter(props.logGroup, "FeatureFlagReadSucceeded", "TREATMENT", "1");
    this.addFilter(props.logGroup, "FeatureFlagReadFellBack", "FALLBACK", "1");
    this.addFilter(props.logGroup, "FeatureFlagReadDurationMs", undefined, "$.durationMs");
  }

  /** @param outcome - Matches `$.outcome`; omit to match every read. */
  private addFilter(logGroup: logs.ILogGroup, metricName: string, outcome: string | undefined, metricValue: string): void {
    const patterns = [
      logs.FilterPattern.stringValue("$.message", "=", "FeatureFlagRead"),
      logs.FilterPattern.exists("$.functionName"),
      logs.FilterPattern.exists("$.flagKey"),
    ];
    if (outcome) {
      patterns.push(logs.FilterPattern.stringValue("$.outcome", "=", outcome));
    } else {
      patterns.push(logs.FilterPattern.exists("$.durationMs"));
    }
    new logs.MetricFilter(this, `${metricName}Filter`, {
      logGroup,
      metricNamespace: FEATURE_FLAG_METRIC_NAMESPACE,
      metricName,
      filterPattern: logs.FilterPattern.all(...patterns),
      metricValue,
      dimensions: DIMENSIONS,
    });
  }
}
