import { useState, type ReactElement } from "react";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { describeCron } from "../../models/cronSchedule";
import { DeleteIcon, HistoryIcon, LoadIcon } from "../icons";
import { JobRunHistoryTable } from "../data/JobRunHistoryTable";

export interface JobDefinitionListProps {
  jobs: WarehouseJobDefinition[];
  jobRuns: WarehouseJobRun[];
  onDelete: (name: string) => Promise<void>;
  isDeleting: boolean;
  deleteError: Error | null;
  /** When provided, shows a Load action per row — fetches the job's SQL into a new query tab (`7-data-warehousing.md` §12b's job-edit flow). */
  onLoad?: (job: WarehouseJobDefinition) => void;
  /** The job name currently being loaded (disables its own Load button), if any. */
  loadingName?: string | null;
}

const ICON_BUTTON =
  "rounded p-1.5 text-fg-muted transition-transform transition-colors hover:scale-110 hover:text-fg disabled:opacity-50 disabled:hover:scale-100";

/**
 * The job-management list (7-data-warehousing.md §12b, Leg 8; condensed
 * to a vertical row layout so the panel never needs horizontal scroll) —
 * one row per job (name + cadence subtext), three icon actions
 * (Load/History/Delete), and a per-row expandable run history reusing
 * `JobRunHistoryTable`. Deleting a job only removes its definition/
 * schedule; its history stays visible here (§8's "keep history" call).
 */
export function JobDefinitionList({
  jobs,
  jobRuns,
  onDelete,
  isDeleting,
  deleteError,
  onLoad,
  loadingName,
}: JobDefinitionListProps): ReactElement {
  const [confirmingName, setConfirmingName] = useState<string | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);

  async function handleConfirmDelete(name: string): Promise<void> {
    try {
      await onDelete(name);
    } catch {
      /* deleteError already surfaces the failure below. */
    } finally {
      setConfirmingName(null);
    }
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-fg-subtle">No jobs yet — create one above.</p>;
  }

  return (
    <div className="space-y-2">
      {deleteError && (
        <p role="alert" className="text-sm text-danger">
          {deleteError.message}
        </p>
      )}
      <ul className="space-y-1">
        {jobs.map((job) => (
          <li key={job.job_name} className="rounded-lg border border-line">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-fg">{job.job_name}</p>
                <p className="truncate text-xs text-fg-subtle">{describeCron(job.cadence_cron ?? "")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {onLoad && (
                  <button
                    type="button"
                    onClick={() => onLoad(job)}
                    disabled={loadingName === job.job_name}
                    aria-label={loadingName === job.job_name ? `Loading ${job.job_name}` : `Load job ${job.job_name}`}
                    title="Load into a new query tab"
                    className={ICON_BUTTON}
                  >
                    <LoadIcon />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpandedName(expandedName === job.job_name ? null : job.job_name)}
                  aria-expanded={expandedName === job.job_name}
                  aria-label={`${expandedName === job.job_name ? "Hide" : "Show"} run history for ${job.job_name}`}
                  title="Run history"
                  className={ICON_BUTTON}
                >
                  <HistoryIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingName(job.job_name)}
                  aria-label={`Delete job ${job.job_name}`}
                  title="Delete"
                  className={`${ICON_BUTTON} hover:text-hue-rose`}
                >
                  <DeleteIcon />
                </button>
              </div>
            </div>
            {confirmingName === job.job_name && (
              <div className="flex items-center gap-2 border-t border-line bg-panel px-3 py-2 text-xs">
                <span className="text-hue-amber">Delete {job.job_name}?</span>
                <button
                  type="button"
                  onClick={() => void handleConfirmDelete(job.job_name)}
                  disabled={isDeleting}
                  className="rounded bg-rose-600/80 px-2 py-1 text-fg disabled:opacity-50"
                >
                  {isDeleting ? "Deleting…" : "Confirm"}
                </button>
                <button type="button" onClick={() => setConfirmingName(null)} className="rounded bg-panel-hover px-2 py-1 text-fg">
                  Cancel
                </button>
              </div>
            )}
            {expandedName === job.job_name && (
              <div className="border-t border-line bg-surface p-3">
                <div className="rounded-2xl bg-panel p-4">
                  <JobRunHistoryTable jobRuns={jobRuns.filter((run) => run.job_name === job.job_name)} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
