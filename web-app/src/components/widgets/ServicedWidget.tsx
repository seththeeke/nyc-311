import type { ReactElement } from "react";
import { WorkspaceMetricTile } from "./WorkspaceMetricTile";
import { formatCount } from "./workspaceMetricFormat";

/** Orders resolved in the latest report week. */
export function ServicedWidget(): ReactElement {
  return <WorkspaceMetricTile metricId="SERVICED" label="Serviced" formatValue={formatCount} />;
}
