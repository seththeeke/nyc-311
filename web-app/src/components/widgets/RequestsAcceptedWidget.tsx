import type { ReactElement } from "react";
import { WorkspaceMetricTile } from "./WorkspaceMetricTile";
import { formatCount } from "./workspaceMetricFormat";

/** Orders accepted in the latest report week. */
export function RequestsAcceptedWidget(): ReactElement {
  return <WorkspaceMetricTile metricId="REQUESTS_ACCEPTED" label="Requests accepted" formatValue={formatCount} />;
}
