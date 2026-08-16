import type { ReactElement } from "react";
import type { PollerMetrics } from "../../models/pollerMetrics";
import { formatAbsoluteDateTime, formatCompactNumber, formatRelativeTime } from "./formatters";
import { IV_COLORS } from "./palette";
import { Sparkline } from "./Sparkline";
import { StatusIcon } from "./StatusIcon";

export interface IngestionStatTilesProps {
  metrics: PollerMetrics[];
}

const SPARKLINE_WINDOW = 20;

function statusRateColor(pct: number): string {
  if (pct >= 90) return IV_COLORS.statusGood;
  if (pct >= 70) return IV_COLORS.statusWarning;
  return IV_COLORS.statusCritical;
}

interface StatTileProps {
  label: string;
  value: string;
  sub?: ReactElement;
  sparklineValues?: number[];
}

function StatTile({ label, value, sub, sparklineValues }: StatTileProps): ReactElement {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      {sub}
      {sparklineValues && (
        <div className="mt-2">
          <Sparkline values={sparklineValues} />
        </div>
      )}
    </div>
  );
}

// The KPI row — a handful of headline numbers, per the dataviz skill's
// "is it even a chart?" heuristic: this data's job is a few current values,
// not a plot, so it's a row of stat tiles rather than a bar/line chart.
export function IngestionStatTiles({ metrics }: IngestionStatTilesProps): ReactElement {
  const totalIngested = metrics.reduce((sum, m) => sum + m.records_ingested, 0);
  const totalRuns = metrics.length;
  const successCount = metrics.filter((m) => m.success).length;
  const successRatePct = Math.round((successCount / totalRuns) * 100);
  const lastRun = metrics[0];

  const recent = metrics.slice(0, SPARKLINE_WINDOW);
  const sparklineValues = [...recent].reverse().map((m) => m.records_ingested);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Records ingested"
        value={formatCompactNumber(totalIngested)}
        sparklineValues={sparklineValues}
      />
      <StatTile
        label="Success rate"
        value={`${successRatePct}%`}
        sub={
          <p className="mt-1 flex items-center gap-1 text-sm" style={{ color: statusRateColor(successRatePct) }}>
            <StatusIcon success={successRatePct >= 90} className="h-3.5 w-3.5" />
            {successCount} of {totalRuns} runs
          </p>
        }
      />
      <StatTile label="Total runs" value={totalRuns.toLocaleString("en-US")} />
      <StatTile
        label="Last run"
        value={formatRelativeTime(lastRun.ran_at)}
        sub={
          <p
            className="mt-1 flex items-center gap-1 text-sm"
            style={{ color: lastRun.success ? IV_COLORS.statusGood : IV_COLORS.statusCritical }}
            title={formatAbsoluteDateTime(lastRun.ran_at)}
          >
            <StatusIcon success={lastRun.success} className="h-3.5 w-3.5" />
            {lastRun.success ? "Succeeded" : "Failed"}
          </p>
        }
      />
    </div>
  );
}
