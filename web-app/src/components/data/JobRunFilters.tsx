import type { ChangeEvent, ReactElement } from "react";
import { WAREHOUSE_JOB_RUN_STATUSES, WAREHOUSE_JOB_RUN_TRIGGERS } from "../../models/warehouseJobRun";
import type { WarehouseJobRunStatus, WarehouseJobRunTrigger } from "../../models/warehouseJobRun";

export interface JobRunFiltersProps {
  status: WarehouseJobRunStatus | "";
  trigger: WarehouseJobRunTrigger | "";
  jobName: string;
  onStatusChange: (status: WarehouseJobRunStatus | "") => void;
  onTriggerChange: (trigger: WarehouseJobRunTrigger | "") => void;
  onJobNameChange: (jobName: string) => void;
}

const SELECT_CLASSES =
  "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus:border-cyan-400/50 focus:outline-none";

const INPUT_CLASSES = SELECT_CLASSES;

/** Client-side filters over the already-fetched job run list — the dataset is small (§9), no server-side filtering needed. */
export function JobRunFilters({
  status,
  trigger,
  jobName,
  onStatusChange,
  onTriggerChange,
  onJobNameChange,
}: JobRunFiltersProps): ReactElement {
  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>): void {
    onStatusChange(event.target.value as WarehouseJobRunStatus | "");
  }

  function handleTriggerChange(event: ChangeEvent<HTMLSelectElement>): void {
    onTriggerChange(event.target.value as WarehouseJobRunTrigger | "");
  }

  function handleJobNameChange(event: ChangeEvent<HTMLInputElement>): void {
    onJobNameChange(event.target.value);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="job-run-status-filter" className="text-xs font-medium text-slate-400">
          Status
        </label>
        <select id="job-run-status-filter" value={status} onChange={handleStatusChange} className={SELECT_CLASSES}>
          <option value="">All statuses</option>
          {WAREHOUSE_JOB_RUN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="job-run-trigger-filter" className="text-xs font-medium text-slate-400">
          Trigger
        </label>
        <select id="job-run-trigger-filter" value={trigger} onChange={handleTriggerChange} className={SELECT_CLASSES}>
          <option value="">All triggers</option>
          {WAREHOUSE_JOB_RUN_TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="job-run-name-filter" className="text-xs font-medium text-slate-400">
          Job name
        </label>
        <input
          id="job-run-name-filter"
          type="text"
          value={jobName}
          onChange={handleJobNameChange}
          placeholder="Filter by job_name"
          className={INPUT_CLASSES}
        />
      </div>
    </div>
  );
}
