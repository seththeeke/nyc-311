import { useState, type ReactElement } from "react";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { JobDefinitionForm } from "./JobDefinitionForm";
import { JobDefinitionList } from "./JobDefinitionList";

export interface WarehouseJobsPanelProps {
  jobs: WarehouseJobDefinition[];
  jobsLoading: boolean;
  jobsError: boolean;
  jobRuns: WarehouseJobRun[];
  createJob: (name: string, sql: string, cadenceCron: string) => Promise<WarehouseJobDefinition>;
  isCreating: boolean;
  createError: Error | null;
  deleteJob: (name: string) => Promise<void>;
  isDeleting: boolean;
  deleteError: Error | null;
  onLoad: (job: WarehouseJobDefinition) => void;
  loadingName: string | null;
}

/**
 * The Jobs panel's body (`7-data-warehousing.md` §12b's admin warehouse
 * redesign) — a "New job" toggle, the list (with per-row Load/Delete/
 * History), and the create form when open. Kept out of
 * `AdminWarehousePage` to stay under CLAUDE.md §5.1's 200-line component
 * cap.
 */
export function WarehouseJobsPanel({
  jobs,
  jobsLoading,
  jobsError,
  jobRuns,
  createJob,
  isCreating,
  createError,
  deleteJob,
  isDeleting,
  deleteError,
  onLoad,
  loadingName,
}: WarehouseJobsPanelProps): ReactElement {
  const [showNewJobForm, setShowNewJobForm] = useState(false);

  if (jobsLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (jobsError) return <p className="text-sm text-red-400">Failed to load jobs.</p>;

  return (
    <div className="space-y-4">
      {showNewJobForm ? (
        <JobDefinitionForm
          onCreate={createJob}
          isCreating={isCreating}
          error={createError}
          onCreated={() => setShowNewJobForm(false)}
          onCancel={() => setShowNewJobForm(false)}
        />
      ) : (
        <button type="button" onClick={() => setShowNewJobForm(true)} className="rounded bg-emerald-600 px-4 py-2 text-white">
          New job
        </button>
      )}
      <JobDefinitionList
        jobs={jobs}
        jobRuns={jobRuns}
        onDelete={deleteJob}
        isDeleting={isDeleting}
        deleteError={deleteError}
        onLoad={onLoad}
        loadingName={loadingName}
      />
    </div>
  );
}
