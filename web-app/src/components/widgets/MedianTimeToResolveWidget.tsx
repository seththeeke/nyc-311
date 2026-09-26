import type { ReactElement } from "react";
import { WorkspaceMetricTile } from "./WorkspaceMetricTile";
import { formatHours } from "./workspaceMetricFormat";

/** Median resolution time for orders resolved in the latest report week. */
export function MedianTimeToResolveWidget(): ReactElement {
  return <WorkspaceMetricTile metricId="MEDIAN_TIME_TO_RESOLVE_HOURS" label="Median time to resolve" formatValue={formatHours} />;
}
