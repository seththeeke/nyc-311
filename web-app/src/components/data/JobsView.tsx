import { useMemo, useState, type ReactElement } from "react";
import type { WarehouseJobRun, WarehouseJobRunStatus, WarehouseJobRunTrigger } from "../../models/warehouseJobRun";
import { JobRunFilters } from "./JobRunFilters";
import { JobRunHistoryTable } from "./JobRunHistoryTable";

export interface JobsViewProps {
  jobRuns: WarehouseJobRun[];
}

/** The "Jobs" view (7-data-warehousing.md §12) — filterable job run history. Owns its own client-side filter state. */
export function JobsView({ jobRuns }: JobsViewProps): ReactElement {
  const [status, setStatus] = useState<WarehouseJobRunStatus | "">("");
  const [trigger, setTrigger] = useState<WarehouseJobRunTrigger | "">("");
  const [jobName, setJobName] = useState("");

  const filtered = useMemo(
    () =>
      jobRuns.filter(
        (jobRun) =>
          (status === "" || jobRun.status === status) &&
          (trigger === "" || jobRun.trigger === trigger) &&
          (jobName === "" || jobRun.job_name.toLowerCase().includes(jobName.toLowerCase()))
      ),
    [jobRuns, status, trigger, jobName]
  );

  return (
    <>
      <JobRunFilters
        status={status}
        trigger={trigger}
        jobName={jobName}
        onStatusChange={setStatus}
        onTriggerChange={setTrigger}
        onJobNameChange={setJobName}
      />
      {filtered.length === 0 ? (
        <p className="mt-4 text-slate-500">No job runs match these filters.</p>
      ) : (
        <div className="mt-4">
          <JobRunHistoryTable jobRuns={filtered} />
        </div>
      )}
    </>
  );
}
