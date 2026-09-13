import { Fragment, useState, type ReactElement } from "react";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { describeCron } from "../../models/cronSchedule";
import { JobRunHistoryTable } from "../data/JobRunHistoryTable";

export interface JobDefinitionListProps {
  jobs: WarehouseJobDefinition[];
  jobRuns: WarehouseJobRun[];
  onDelete: (name: string) => Promise<void>;
  isDeleting: boolean;
  deleteError: Error | null;
}

/**
 * The job-management table (7-data-warehousing.md §12b, Leg 8): one row
 * per job definition, an inline delete confirmation (no native `confirm()`
 * dialog), and a per-row expandable run history — reuses
 * `JobRunHistoryTable` from `components/data/`, scoped to that one
 * `job_name` rather than showing every job's runs at once. Deleting a job
 * only removes its definition/schedule; its history stays visible here
 * (§8's "keep history" design call).
 */
export function JobDefinitionList({ jobs, jobRuns, onDelete, isDeleting, deleteError }: JobDefinitionListProps): ReactElement {
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
    return <p className="text-sm text-slate-400">No jobs yet — create one above.</p>;
  }

  return (
    <div className="space-y-2">
      {deleteError && (
        <p role="alert" className="text-sm text-red-400">
          {deleteError.message}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/[0.04] text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Job
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Cadence
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Created
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {jobs.map((job) => (
              <Fragment key={job.job_name}>
                <tr>
                  <td className="px-4 py-3 font-mono text-slate-200">{job.job_name}</td>
                  <td className="px-4 py-3 text-slate-300">
                    <div>{describeCron(job.cadence_cron)}</div>
                    <div className="font-mono text-xs text-slate-500">{job.cadence_cron}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div>{new Date(job.created_at).toLocaleString()}</div>
                    <div className="font-mono text-xs text-slate-500">{job.created_by}</div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setExpandedName(expandedName === job.job_name ? null : job.job_name)}
                      aria-expanded={expandedName === job.job_name}
                      className="mr-2 rounded bg-white/10 px-3 py-1 text-slate-200 hover:bg-white/20"
                    >
                      {expandedName === job.job_name ? "Hide history" : "History"}
                    </button>
                    {confirmingName === job.job_name ? (
                      <>
                        <span className="mr-2 text-xs text-amber-400">Delete {job.job_name}?</span>
                        <button
                          type="button"
                          onClick={() => void handleConfirmDelete(job.job_name)}
                          disabled={isDeleting}
                          className="mr-2 rounded bg-rose-600/80 px-3 py-1 text-white disabled:opacity-50"
                        >
                          {isDeleting ? "Deleting…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingName(null)}
                          className="rounded bg-white/10 px-3 py-1 text-slate-200"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingName(job.job_name)}
                        className="rounded bg-rose-600/80 px-3 py-1 text-white"
                        aria-label={`Delete job ${job.job_name}`}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
                {expandedName === job.job_name && (
                  <tr>
                    <td colSpan={4} className="bg-slate-950 p-4">
                      <div className="rounded-2xl bg-white p-4">
                        <JobRunHistoryTable jobRuns={jobRuns.filter((run) => run.job_name === job.job_name)} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
