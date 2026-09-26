import type { ReactElement } from "react";
import type { LambdaHealthPoint } from "../../models/lambdaMetrics";
import { niceMax } from "../ingestion/formatters";
import { IV_COLORS } from "../ingestion/palette";

export interface LambdaLatencyChartProps {
  points: LambdaHealthPoint[];
}

const CHART_HEIGHT_PX = 56;

type TimedPoint = LambdaHealthPoint & { avgDurationMs: number };

function hasLatency(point: LambdaHealthPoint): point is TimedPoint {
  return point.avgDurationMs !== null;
}

/* Invocation-weighted, so one quiet slow day doesn't swamp a busy fast week. */
function weeklyAverage(points: TimedPoint[]): number {
  const invocations = points.reduce((sum, p) => sum + p.invocations, 0);
  if (invocations === 0) return points.reduce((sum, p) => sum + p.avgDurationMs, 0) / points.length;
  return points.reduce((sum, p) => sum + p.avgDurationMs * p.invocations, 0) / invocations;
}

/**
 * Daily average Lambda `Duration` per day, with the day's maximum on
 * hover — for an API Lambda, its server-side latency over the week.
 * Days with no datapoint keep an empty slot, so the x-axis lines up with
 * the invocations chart above it.
 */
export function LambdaLatencyChart({ points }: LambdaLatencyChartProps): ReactElement {
  const timed = points.filter(hasLatency);
  if (timed.length === 0) {
    return <p className="mt-3 text-xs text-fg-subtle">No latency data in the last 7 days.</p>;
  }

  const axisMax = niceMax(Math.max(...timed.map((p) => p.avgDurationMs), 1));
  const peak = Math.max(...timed.map((p) => p.maxDurationMs ?? p.avgDurationMs));

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2 text-xs text-fg-subtle">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: IV_COLORS.seriesIngested }} />
          Avg latency
        </span>
        <span>
          {Math.round(weeklyAverage(timed))} ms avg · {peak} ms max (7d)
        </span>
      </div>
      <div className="mt-2 flex items-end gap-2 border-b border-line" style={{ height: CHART_HEIGHT_PX }}>
        {points.map((point) => {
          const label =
            point.avgDurationMs === null
              ? `${point.date}: no latency data`
              : `${point.date}: ${point.avgDurationMs} ms average, ${point.maxDurationMs ?? point.avgDurationMs} ms max`;
          return (
            <div key={point.date} role="img" aria-label={label} data-tooltip={label} className="flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${((point.avgDurationMs ?? 0) / axisMax) * 100}%`,
                  backgroundColor: IV_COLORS.seriesIngested,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
