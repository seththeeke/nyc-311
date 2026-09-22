import type { ReactElement } from "react";
import { describeShares, slicePath, toShares } from "../chartShares";
import { MOCK_ORDERS_BY_STATUS } from "./mockChartData";
import { ShareLegend } from "../ShareLegend";

const SIZE = 104;
const RADIUS = SIZE / 2 - 2;

/** WIP: a pie of Orders by status, mocked data. Slices are separated by a surface-coloured gap and named in the legend beside it. */
export function MockOrdersByStatusWidget(): ReactElement {
  const shares = toShares(MOCK_ORDERS_BY_STATUS);
  let cursor = 0;

  return (
    <div className="flex items-center gap-4">
      <svg
        role="img"
        aria-label={`Orders by status: ${describeShares(shares)}`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="shrink-0"
      >
        {shares.map((share) => {
          const start = cursor;
          cursor += share.percent / 100;
          return (
            <path
              key={share.label}
              d={slicePath(SIZE / 2, SIZE / 2, RADIUS, start, cursor)}
              fill={share.color}
              strokeWidth={2}
              className="stroke-popover"
            >
              <title>{`${share.label}: ${Math.round(share.percent)}%`}</title>
            </path>
          );
        })}
      </svg>
      <div className="min-w-0 flex-1">
        <ShareLegend shares={shares} />
      </div>
    </div>
  );
}
