import type { ReactElement } from "react";
import { describeShares, toShares } from "./chartShares";
import { MOCK_FLEET_UTILIZATION } from "./mockChartData";
import { ShareLegend } from "./ShareLegend";

/** WIP: a left-to-right stacked bar of fleet time by activity, mocked data. Segments are gapped and the legend below names each with its percent. */
export function MockFleetUtilizationWidget(): ReactElement {
  const shares = toShares(MOCK_FLEET_UTILIZATION);

  return (
    <div>
      <div
        role="img"
        aria-label={`Fleet utilization: ${describeShares(shares)}`}
        className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md"
      >
        {shares.map((share) => (
          <div
            key={share.label}
            title={`${share.label}: ${Math.round(share.percent)}%`}
            className="h-full first:rounded-l-md last:rounded-r-md"
            style={{ width: `${share.percent}%`, backgroundColor: share.color }}
          />
        ))}
      </div>
      <div className="mt-2">
        <ShareLegend shares={shares} />
      </div>
    </div>
  );
}
