import { useState, type ReactElement } from "react";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { MAX_JOB_RETRIES } from "../../models/warehouseJobRun";
import { formatAbsoluteDateTime, formatBytes, formatDuration, formatMillis } from "./formatters";
import { getJobRunStatusVisual } from "./warehouseJobStatusVisuals";
import { PipelineStatusIcon } from "../pipeline/PipelineStatusIcon";

export interface JobRunHistoryTableProps {
  jobRuns: WarehouseJobRun[];
}

const TRIGGER_BADGE_CLASSES: Record<WarehouseJobRun["trigger"], string> = {
  SCHEDULED: "bg-cyan-100 text-cyan-800",
  RETRY: "bg-amber-100 text-amber-800",
  MANUAL: "bg-violet-100 text-violet-800",
};

function TriggerBadge({ trigger }: { trigger: WarehouseJobRun["trigger"] }): ReactElement {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TRIGGER_BADGE_CLASSES[trigger]}`}>
      {trigger}
    </span>
  );
}

function shortId(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 8)}…`;
}

function JobRunDetailRow({ jobRun, detailId }: { jobRun: WarehouseJobRun; detailId: string }): ReactElement {
  const retriesExhausted = jobRun.status === "FAILED" && jobRun.retry_count >= MAX_JOB_RETRIES;

  return (
    <tr id={detailId} className="border-b border-slate-100 bg-slate-50">
      <td colSpan={6} className="px-4 py-3 text-sm text-slate-600">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Run ID</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-700">{jobRun.job_run_id}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Execution ref</dt>
            <dd className="mt-0.5 font-mono text-xs break-all text-slate-700">{jobRun.execution_ref ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Retries</dt>
            <dd className="mt-0.5 text-slate-700">
              {jobRun.retried_from_job_run_id ? `↻ retry of ${shortId(jobRun.retried_from_job_run_id)}, ` : ""}
              attempt {jobRun.retry_count + 1}
              {retriesExhausted && (
                <span className="ml-1 font-medium text-rose-700">— retries exhausted (max {MAX_JOB_RETRIES})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Query performance</dt>
            <dd className="mt-0.5 text-slate-700">
              {jobRun.data_scanned_bytes !== null ? formatBytes(jobRun.data_scanned_bytes) : "—"} scanned,{" "}
              {jobRun.engine_execution_time_ms !== null ? formatMillis(jobRun.engine_execution_time_ms) : "—"} engine
              time, {jobRun.query_queue_time_ms !== null ? formatMillis(jobRun.query_queue_time_ms) : "—"} queued
            </dd>
          </div>
          {jobRun.error_message && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Error</dt>
              <dd className="mt-0.5 text-rose-700">{jobRun.error_message}</dd>
            </div>
          )}
        </dl>
      </td>
    </tr>
  );
}

function JobRunRow({
  jobRun,
  expanded,
  onToggle,
}: {
  jobRun: WarehouseJobRun;
  expanded: boolean;
  onToggle: () => void;
}): ReactElement {
  const visual = getJobRunStatusVisual(jobRun.status);
  const detailId = `job-run-detail-${jobRun.job_run_id}`;

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="py-2 pr-1 pl-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={expanded ? "Hide run details" : "Show run details"}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          </button>
        </td>
        <td className="py-2 pr-4 font-mono text-xs text-slate-700">{jobRun.job_name}</td>
        <td className="py-2 pr-4">
          <span className="inline-flex items-center" title={visual.label}>
            <PipelineStatusIcon category={visual.category} className="h-4 w-4" style={{ color: visual.color }} />
            <span className="sr-only">{visual.label}</span>
          </span>
        </td>
        <td className="py-2 pr-4">
          <TriggerBadge trigger={jobRun.trigger} />
        </td>
        <td className="py-2 pr-4 text-slate-500">{formatAbsoluteDateTime(jobRun.started_at)}</td>
        <td className="py-2 text-right tabular-nums text-slate-500">
          {formatDuration(jobRun.started_at, jobRun.completed_at)}
        </td>
      </tr>
      {expanded && <JobRunDetailRow jobRun={jobRun} detailId={detailId} />}
    </>
  );
}

/** Job run history, most recent first — every field is expandable per row rather than crowding the main table (same shape as PipelineExecutionHistory). */
export function JobRunHistoryTable({ jobRuns }: JobRunHistoryTableProps): ReactElement {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  function toggle(jobRunId: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobRunId)) {
        next.delete(jobRunId);
      } else {
        next.add(jobRunId);
      }
      return next;
    });
  }

  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-md border border-slate-100">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Warehouse job run history matching the current filters, most recent first</caption>
        <thead className="sticky top-0 bg-white/95 backdrop-blur-sm">
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th scope="col" className="py-2 pr-1 pl-2">
              <span className="sr-only">Expand row</span>
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Job
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Trigger
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Started
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Duration
            </th>
          </tr>
        </thead>
        <tbody>
          {jobRuns.map((jobRun) => (
            <JobRunRow
              key={jobRun.job_run_id}
              jobRun={jobRun}
              expanded={expandedIds.has(jobRun.job_run_id)}
              onToggle={() => toggle(jobRun.job_run_id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
