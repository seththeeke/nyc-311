import type { ReactElement } from "react";
import { WorkspaceMetricTile } from "./WorkspaceMetricTile";
import { formatHours } from "./workspaceMetricFormat";

/** Mean resolution time for orders resolved in the latest report week. */
export function MeanTimeToResolveWidget(): ReactElement {
  return <WorkspaceMetricTile metricId="MEAN_TIME_TO_RESOLVE_HOURS" label="Mean time to resolve" formatValue={formatHours} />;
}
