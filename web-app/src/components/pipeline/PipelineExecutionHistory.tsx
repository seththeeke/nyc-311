import { useState, type ReactElement } from "react";
import type { PipelineExecution } from "../../models/pipelineStatus";
import { formatAbsoluteDateTime, formatDuration, formatRelativeTime } from "./formatters";
import { getStatusVisual } from "./pipelineStatusVisuals";
import { PipelineStatusIcon } from "./PipelineStatusIcon";

export interface PipelineExecutionHistoryProps {
  executions: PipelineExecution[];
}

/** Just the commit's subject line — the condensed row has no room for the full body. */
function firstLine(message: string): string {
  const newlineIndex = message.indexOf("\n");
  return newlineIndex === -1 ? message : message.slice(0, newlineIndex);
}

function ExecutionDetailRow({ execution, detailId }: { execution: PipelineExecution; detailId: string }): ReactElement {
  return (
    <tr id={detailId} className="border-b border-slate-100 bg-slate-50">
      <td colSpan={5} className="px-4 py-3 text-sm text-slate-600">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Commit message</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-slate-700">
              {execution.commitMessage ?? "Pipeline restart (no commit)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Commit ID</dt>
            <dd className="mt-0.5 text-slate-700">{execution.commitId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Execution ID</dt>
            <dd className="mt-0.5 text-slate-700">{execution.executionId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Started</dt>
            <dd className="mt-0.5 text-slate-700">
              {execution.startTime ? formatAbsoluteDateTime(execution.startTime) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">Last update</dt>
            <dd className="mt-0.5 text-slate-700">
              {execution.lastUpdateTime ? formatAbsoluteDateTime(execution.lastUpdateTime) : "—"}
            </dd>
          </div>
        </dl>
      </td>
    </tr>
  );
}

function ExecutionRow({
  execution,
  expanded,
  onToggle,
}: {
  execution: PipelineExecution;
  expanded: boolean;
  onToggle: () => void;
}): ReactElement {
  const visual = getStatusVisual(execution.status);
  const detailId = `pipeline-execution-detail-${execution.executionId}`;

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="py-2 pr-1 pl-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={expanded ? "Hide execution details" : "Show execution details"}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          </button>
        </td>
        <td className="max-w-xs truncate py-2 pr-4">
          {execution.commitMessage ? (
            <span className="text-slate-700">{firstLine(execution.commitMessage)}</span>
          ) : (
            // A StartPipelineExecution-triggered restart (self-mutation),
            // not a push — genuinely has no commit to show, not a data gap.
            <span className="text-slate-400 italic">Pipeline restart (no commit)</span>
          )}
        </td>
        <td className="py-2 pr-4">
          {/* The icon (a distinct glyph shape per category, not just a
              color) already communicates status — this text stays for
              screen readers and a hover tooltip instead of visibly
              duplicating it next to the icon. */}
          <span className="inline-flex items-center" title={visual.label}>
            <PipelineStatusIcon category={visual.category} className="h-4 w-4" style={{ color: visual.color }} />
            <span className="sr-only">{visual.label}</span>
          </span>
        </td>
        <td className="py-2 pr-4 text-slate-500">
          {execution.startTime ? formatRelativeTime(execution.startTime) : "—"}
        </td>
        <td className="py-2 text-right tabular-nums text-slate-500">
          {execution.startTime ? formatDuration(execution.startTime, execution.lastUpdateTime) : "—"}
        </td>
      </tr>
      {expanded && <ExecutionDetailRow execution={execution} detailId={detailId} />}
    </>
  );
}

// A bounded, internally-scrolling list rather than growing the page —
// the pipeline stages above stay in view no matter how long the
// execution history gets.
export function PipelineExecutionHistory({ executions }: PipelineExecutionHistoryProps): ReactElement {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  function toggle(executionId: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(executionId)) {
        next.delete(executionId);
      } else {
        next.add(executionId);
      }
      return next;
    });
  }

  return (
    <div data-testid="execution-history-scroll" className="max-h-[26rem] overflow-y-auto rounded-md border border-slate-100">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Nyc311Pipeline execution history, most recent first</caption>
        <thead className="sticky top-0 bg-white/95 backdrop-blur-sm">
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th scope="col" className="py-2 pr-1 pl-2">
              <span className="sr-only">Expand row</span>
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Commit
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Status
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
          {executions.map((execution) => (
            <ExecutionRow
              key={execution.executionId}
              execution={execution}
              expanded={expandedIds.has(execution.executionId)}
              onToggle={() => toggle(execution.executionId)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
