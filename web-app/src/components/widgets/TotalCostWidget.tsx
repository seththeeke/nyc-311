import type { ReactElement } from "react";
import { WorkspaceMetricTile } from "./WorkspaceMetricTile";
import { formatCurrency } from "./workspaceMetricFormat";

/** Estimated total cost for the latest report week — "no data yet" until the report adds `total_cost`. */
export function TotalCostWidget(): ReactElement {
  return <WorkspaceMetricTile metricId="TOTAL_COST" label="Total cost" formatValue={formatCurrency} />;
}
