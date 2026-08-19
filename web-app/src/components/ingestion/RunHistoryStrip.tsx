import type { ReactElement } from "react";
import type { PollerMetrics } from "../../models/pollerMetrics";
import { formatAbsoluteDateTime } from "./formatters";
import { IV_COLORS } from "./palette";
import { StatusIcon } from "./StatusIcon";

export interface RunHistoryStripProps {
  metrics: PollerMetrics[];
}

const STRIP_WINDOW = 40;

function runSummary(run: PollerMetrics): string {
  const when = formatAbsoluteDateTime(run.ran_at);
  if (run.success) {
    return `${when}: succeeded, ${run.records_ingested} ingested, ${run.duplicates_skipped} duplicates skipped`;
  }
  return `${when}: failed${run.error_message ? ` — ${run.error_message}` : ""}`;
}

function LegendSwatch({ success, label }: { success: boolean; label: string }): ReactElement {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex h-4 w-4 items-center justify-center rounded"
        style={{ backgroundColor: success ? IV_COLORS.statusGood : IV_COLORS.statusCritical }}
      >
        <StatusIcon success={success} className="h-2.5 w-2.5 text-white" />
      </span>
      {label}
    </span>
  );
}

/*
 * Status is a state, not a series identity — it wears the fixed status
 * scale (dataviz skill), never a categorical hue, and every block carries
 * an icon (StatusIcon) alongside the color so it never reads by hue alone.
 */
export function RunHistoryStrip({ metrics }: RunHistoryStripProps): ReactElement {
  const recent = metrics.slice(0, STRIP_WINDOW);
  const chronological = [...recent].reverse();

  return (
    <div>
      <div className="flex flex-wrap items-end gap-[2px]">
        {chronological.map((run) => (
          <button
            key={run.ran_at}
            type="button"
            aria-label={runSummary(run)}
            className="group relative flex h-7 w-3.5 shrink-0 items-center justify-center rounded transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
            style={{ backgroundColor: run.success ? IV_COLORS.statusGood : IV_COLORS.statusCritical }}
          >
            <StatusIcon success={run.success} className="h-3 w-3 text-white" />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-56 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              <span className="block font-medium">{run.success ? "Succeeded" : "Failed"}</span>
              <span className="block text-slate-300">{formatAbsoluteDateTime(run.ran_at)}</span>
              {run.success ? (
                <span className="block text-slate-300">
                  {run.records_ingested} ingested · {run.duplicates_skipped} duplicates
                </span>
              ) : (
                run.error_message && <span className="block text-slate-300">{run.error_message}</span>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <LegendSwatch success label="Succeeded" />
        <LegendSwatch success={false} label="Failed" />
      </div>
    </div>
  );
}
