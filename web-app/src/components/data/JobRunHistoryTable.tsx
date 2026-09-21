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
  SCHEDULED: "bg-cyan-100 text-hue-cyan",
  RETRY: "bg-amber-100 text-hue-amber",
  MANUAL: "bg-violet-100 text-hue-violet",
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
    <tr id={detailId} className="border-b border-line-soft bg-panel-sunken">
      <td colSpan={6} className="px-4 py-3 text-sm text-fg-muted">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Run ID</dt>
            <dd className="mt-0.5 font-mono text-xs text-fg-muted">{jobRun.job_run_id}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Execution ref</dt>
            <dd className="mt-0.5 font-mono text-xs break-all text-fg-muted">{jobRun.execution_ref ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Retries</dt>
            <dd className="mt-0.5 text-fg-muted">
              {jobRun.retried_from_job_run_id ? `↻ retry of ${shortId(jobRun.retried_from_job_run_id)}, ` : ""}
              attempt {jobRun.retry_count + 1}
              {retriesExhausted && (
                <span className="ml-1 font-medium text-hue-rose">— retries exhausted (max {MAX_JOB_RETRIES})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Query performance</dt>
            <dd className="mt-0.5 text-fg-muted">
              {jobRun.data_scanned_bytes !== null ? formatBytes(jobRun.data_scanned_bytes) : "—"} scanned,{" "}
              {jobRun.engine_execution_time_ms !== null ? formatMillis(jobRun.engine_execution_time_ms) : "—"} engine
              time, {jobRun.query_queue_time_ms !== null ? formatMillis(jobRun.query_queue_time_ms) : "—"} queued
            </dd>
          </div>
          {jobRun.error_message && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Error</dt>
              <dd className="mt-0.5 text-hue-rose">{jobRun.error_message}</dd>
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
      <tr className="border-b border-line-soft">
        <td className="py-2 pr-1 pl-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={expanded ? "Hide run details" : "Show run details"}
            className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:bg-panel-hover hover:text-fg-muted"
          >
            <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          </button>
        </td>
        <td className="py-2 pr-4 font-mono text-xs text-fg-muted">{jobRun.job_name}</td>
        <td className="py-2 pr-4">
          <span className="inline-flex items-center" title={visual.label}>
            <PipelineStatusIcon category={visual.category} className="h-4 w-4" style={{ color: visual.color }} />
            <span className="sr-only">{visual.label}</span>
          </span>
        </td>
        <td className="py-2 pr-4">
          <TriggerBadge trigger={jobRun.trigger} />
        </td>
        <td className="py-2 pr-4 text-fg-subtle">{formatAbsoluteDateTime(jobRun.started_at)}</td>
        <td className="py-2 text-right tabular-nums text-fg-subtle">
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
    <div className="max-h-[28rem] overflow-y-auto rounded-md border border-line-soft">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Warehouse job run history matching the current filters, most recent first</caption>
        <thead className="sticky top-0 bg-popover/95 backdrop-blur-sm">
          <tr className="border-b border-line text-left text-fg-subtle">
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
