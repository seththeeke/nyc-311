import type { ReactElement } from "react";
import type { AnalyticsRollup } from "../../models/analyticsRollup";
import { formatAbsoluteDateTime } from "./formatters";

export interface RollupsViewProps {
  rollups: AnalyticsRollup[];
}

interface RunGroup {
  runDate: string;
  computedAt: string;
  rows: AnalyticsRollup[];
  total: number;
}

/* Newest run_date first; within a run, dimensions by descending value. */
function groupByRun(rollups: AnalyticsRollup[]): RunGroup[] {
  const byDate = new Map<string, AnalyticsRollup[]>();
  for (const rollup of rollups) {
    const bucket = byDate.get(rollup.run_date);
    if (bucket) bucket.push(rollup);
    else byDate.set(rollup.run_date, [rollup]);
  }

  return [...byDate.entries()]
    .map(([runDate, rows]) => ({
      runDate,
      computedAt: rows.reduce((latest, r) => (r.computed_at > latest ? r.computed_at : latest), rows[0].computed_at),
      rows: [...rows].sort((a, b) => b.value - a.value),
      total: rows.reduce((sum, r) => sum + r.value, 0),
    }))
    .sort((a, b) => b.runDate.localeCompare(a.runDate));
}

/**
 * The "Rollups" inspection view (7-data-warehousing.md §12) — the sample
 * job's pre-aggregated output straight from AnalyticsRollups: the latest
 * run's count of Orders per dimension, plus a compact history of earlier
 * runs. Read-only; requeuing a job is a write path, out of scope here.
 */
export function RollupsView({ rollups }: RollupsViewProps): ReactElement {
  if (rollups.length === 0) {
    return <p className="text-slate-500">No rollups computed yet — the daily job hasn&apos;t produced a result.</p>;
  }

  const runs = groupByRun(rollups);
  const [latest, ...earlier] = runs;

  return (
    <div>
      <p className="text-xs text-slate-500">
        {latest.rows[0].metric_view} &middot; latest run {latest.runDate} &middot; computed{" "}
        {formatAbsoluteDateTime(latest.computedAt)}
      </p>

      <div className="mt-3 overflow-hidden rounded-md border border-slate-100">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Order count per dimension for the latest run</caption>
          <thead className="bg-white/95">
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th scope="col" className="py-2 pr-4 font-medium">
                Dimension
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Orders
              </th>
            </tr>
          </thead>
          <tbody>
            {latest.rows.map((row) => (
              <tr key={row.rollup_key} className="border-b border-slate-100 last:border-b-0">
                <td className="py-2 pr-4 font-mono text-xs text-slate-700">{row.dimension}</td>
                <td className="py-2 text-right tabular-nums text-slate-700">{row.value.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-medium">
              <td className="py-2 pr-4 text-slate-600">Total</td>
              <td className="py-2 text-right tabular-nums text-slate-900">{latest.total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {earlier.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Earlier runs</h3>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {earlier.map((run) => (
              <li key={run.runDate} className="flex justify-between py-1.5 text-slate-600">
                <span className="tabular-nums">{run.runDate}</span>
                <span className="tabular-nums">
                  {run.total.toLocaleString()} across {run.rows.length}{" "}
                  {run.rows.length === 1 ? "dimension" : "dimensions"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
