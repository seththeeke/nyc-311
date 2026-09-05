import type { ReactElement } from "react";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { formatAbsoluteDateTime, formatBytes, formatMillis } from "./formatters";

export interface PerformanceViewProps {
  jobRuns: WarehouseJobRun[];
}

interface QueryRun {
  job_run_id: string;
  job_name: string;
  started_at: string;
  data_scanned_bytes: number;
  engine_execution_time_ms: number;
  query_queue_time_ms: number;
}

/** Only Athena-query runs carry execution metrics — rebuilds and still-running jobs have null stats. */
function isQueryRun(jobRun: WarehouseJobRun): jobRun is WarehouseJobRun & QueryRun {
  return (
    jobRun.data_scanned_bytes !== null &&
    jobRun.engine_execution_time_ms !== null &&
    jobRun.query_queue_time_ms !== null
  );
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * The "Performance" view (7-data-warehousing.md §12) — Athena execution
 * metrics per query run, the time series meant to back later
 * compaction/optimization analysis (Appendix A.8).
 */
export function PerformanceView({ jobRuns }: PerformanceViewProps): ReactElement {
  const queryRuns = jobRuns.filter(isQueryRun);

  if (queryRuns.length === 0) {
    return <p className="text-slate-500">No completed query runs with execution metrics yet.</p>;
  }

  const avgEngineMs = average(queryRuns.map((run) => run.engine_execution_time_ms));
  const avgScannedBytes = average(queryRuns.map((run) => run.data_scanned_bytes));

  return (
    <div>
      <p className="text-xs text-slate-500">
        {queryRuns.length} query {queryRuns.length === 1 ? "run" : "runs"} &middot; avg engine time{" "}
        {formatMillis(avgEngineMs)} &middot; avg scanned {formatBytes(avgScannedBytes)}
      </p>
      <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-md border border-slate-100">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Athena execution metrics per query run, most recent first</caption>
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm">
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th scope="col" className="py-2 pr-4 font-medium">
                Job
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Started
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Data scanned
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Engine time
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Queue time
              </th>
            </tr>
          </thead>
          <tbody>
            {queryRuns.map((run) => (
              <tr key={run.job_run_id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-mono text-xs text-slate-700">{run.job_name}</td>
                <td className="py-2 pr-4 text-slate-500">{formatAbsoluteDateTime(run.started_at)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-slate-700">
                  {formatBytes(run.data_scanned_bytes)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-slate-700">
                  {formatMillis(run.engine_execution_time_ms)}
                </td>
                <td className="py-2 text-right tabular-nums text-slate-700">
                  {formatMillis(run.query_queue_time_ms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
