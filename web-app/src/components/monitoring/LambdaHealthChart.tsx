import type { ReactElement } from "react";
import type { LambdaHealth } from "../../models/lambdaMetrics";
import { formatCompactNumber, niceMax } from "../ingestion/formatters";
import { IV_COLORS } from "../ingestion/palette";
import { LambdaLatencyChart } from "./LambdaLatencyChart";

export interface LambdaHealthChartProps {
  lambda: LambdaHealth;
}

const CHART_HEIGHT_PX = 120;

function LegendItem({ color, label }: { color: string; label: string }): ReactElement {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/*
 * One stacked-bar chart per Lambda (successes + errors sum to invocations,
 * the same part-to-whole shape as IngestionVolumeChart) — added after the
 * 2026-08-22 fan-out-Lambda incident, where a Lambda erroring on every
 * single invocation had no visual signal anywhere in the dashboard. Daily
 * latency sits underneath (LambdaLatencyChart).
 */
export function LambdaHealthChart({ lambda }: LambdaHealthChartProps): ReactElement {
  const axisMax = niceMax(Math.max(...lambda.points.map((p) => p.invocations), 1));
  const totalInvocations = lambda.points.reduce((sum, p) => sum + p.invocations, 0);
  const totalErrors = lambda.points.reduce((sum, p) => sum + p.errors, 0);

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{lambda.logicalName}</h3>
        <span className="text-xs text-fg-subtle">
          {formatCompactNumber(totalInvocations)} invocations · {formatCompactNumber(totalErrors)} errors (7d)
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-subtle">
        <LegendItem color={IV_COLORS.statusGood} label="Successes" />
        <LegendItem color={IV_COLORS.statusCritical} label="Errors" />
      </div>

      {lambda.points.length === 0 ? (
        <p className="mt-4 text-sm text-fg-subtle">No invocations in the last 7 days.</p>
      ) : (
        /* pt-14 on the outer wrapper reserves headroom for the hover tooltip
           (grows upward from inside each bar) without shrinking the
           fixed-height chart row itself. */
        <div className="mt-3 pt-14">
          <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT_PX }}>
            {lambda.points.map((point) => (
              <div
                key={point.date}
                className="group relative flex h-full flex-1 flex-col-reverse items-stretch gap-[2px]"
              >
                <div
                  className="w-full first:rounded-b-sm"
                  style={{ height: `${(point.successes / axisMax) * 100}%`, backgroundColor: IV_COLORS.statusGood }}
                />
                <div
                  className="w-full last:rounded-t-sm"
                  style={{ height: `${(point.errors / axisMax) * 100}%`, backgroundColor: IV_COLORS.statusCritical }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-md bg-tooltip px-2.5 py-1.5 text-[10px] text-tooltip-fg opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <span className="block font-medium">{point.date}</span>
                  <span className="block text-fg-muted">{point.invocations} invocations</span>
                  <span className="block text-fg-muted">{point.successes} successes</span>
                  <span className="block text-fg-muted">{point.errors} errors</span>
                </span>
                <button
                  type="button"
                  aria-label={`${point.date}: ${point.invocations} invocations, ${point.successes} successes, ${point.errors} errors`}
                  className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
              </div>
            ))}
          </div>
          <LambdaLatencyChart points={lambda.points} />
        </div>
      )}
    </div>
  );
}
