import type { ReactElement } from "react";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { formatAbsoluteDateTime } from "../data/formatters";
import { getJobRunStatusVisual } from "../data/warehouseJobStatusVisuals";
import { PipelineStatusIcon } from "../pipeline/PipelineStatusIcon";

export interface WarehouseJobRunPickerProps {
  jobRuns: WarehouseJobRun[];
  selectedJobRunId: string | null;
  onSelect: (jobRunId: string) => void;
}

/** A run can be picked only once it has a stored result to show — RUNNING/FAILED rows render disabled. */
function isPickable(jobRun: WarehouseJobRun): boolean {
  return jobRun.status === "SUCCEEDED" && jobRun.result_location !== null && jobRun.result_location !== undefined;
}

/**
 * The admin Reports tab's run picker (`7-data-warehousing.md` §12b's
 * addition) — a plain list of job runs, most-recent-first (the order
 * `GET /admin/warehouse/job-runs` — via `useWarehouseJobRuns` — already
 * returns them in), one clickable per `SUCCEEDED` run with a stored
 * result. Deliberately separate from `JobRunHistoryTable` (shared with
 * the public `/data` page and the job-def-list expansion) rather than
 * adding admin-only selection semantics onto that shared component.
 */
export function WarehouseJobRunPicker({ jobRuns, selectedJobRunId, onSelect }: WarehouseJobRunPickerProps): ReactElement {
  if (jobRuns.length === 0) {
    return <p className="text-sm text-fg-subtle">No job runs yet.</p>;
  }

  return (
    <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
      {jobRuns.map((jobRun) => {
        const visual = getJobRunStatusVisual(jobRun.status);
        const pickable = isPickable(jobRun);
        const selected = jobRun.job_run_id === selectedJobRunId;

        return (
          <li key={jobRun.job_run_id}>
            <button
              type="button"
              disabled={!pickable}
              onClick={() => onSelect(jobRun.job_run_id)}
              aria-pressed={selected}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? "border-cyan-400/50 bg-cyan-400/10"
                  : pickable
                    ? "border-line hover:bg-panel"
                    : "cursor-not-allowed border-line-soft opacity-50"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-mono text-fg">{jobRun.job_name}</span>
                <span className="block text-xs text-fg-subtle">{formatAbsoluteDateTime(jobRun.started_at)}</span>
              </span>
              <span className="inline-flex shrink-0 items-center" title={visual.label}>
                <PipelineStatusIcon category={visual.category} className="h-4 w-4" style={{ color: visual.color }} />
                <span className="sr-only">{visual.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
