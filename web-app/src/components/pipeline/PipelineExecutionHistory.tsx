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
    <tr id={detailId} className="border-b border-line-soft bg-panel-sunken">
      <td colSpan={5} className="px-4 py-3 text-sm text-fg-muted">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Commit message</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-fg-muted">
              {execution.commitMessage ?? "Pipeline restart (no commit)"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Commit ID</dt>
            <dd className="mt-0.5 text-fg-muted">{execution.commitId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Execution ID</dt>
            <dd className="mt-0.5 text-fg-muted">{execution.executionId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Started</dt>
            <dd className="mt-0.5 text-fg-muted">
              {execution.startTime ? formatAbsoluteDateTime(execution.startTime) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Last update</dt>
            <dd className="mt-0.5 text-fg-muted">
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
      <tr className="border-b border-line-soft">
        <td className="py-2 pr-1 pl-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={expanded ? "Hide execution details" : "Show execution details"}
            className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:bg-panel-hover hover:text-fg-muted"
          >
            <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          </button>
        </td>
        <td className="max-w-xs truncate py-2 pr-4">
          {execution.commitMessage ? (
            <span className="text-fg-muted">{firstLine(execution.commitMessage)}</span>
          ) : (
            /*
             * A StartPipelineExecution-triggered restart (self-mutation),
             * not a push — genuinely has no commit to show, not a data gap.
             */
            <span className="text-fg-subtle italic">Pipeline restart (no commit)</span>
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
        <td className="py-2 pr-4 text-fg-subtle">
          {execution.startTime ? formatRelativeTime(execution.startTime) : "—"}
        </td>
        <td className="py-2 text-right tabular-nums text-fg-subtle">
          {execution.startTime ? formatDuration(execution.startTime, execution.lastUpdateTime) : "—"}
        </td>
      </tr>
      {expanded && <ExecutionDetailRow execution={execution} detailId={detailId} />}
    </>
  );
}

/*
 * A bounded, internally-scrolling list rather than growing the page —
 * the pipeline stages above stay in view no matter how long the
 * execution history gets.
 */
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
    <div data-testid="execution-history-scroll" className="max-h-[26rem] overflow-y-auto rounded-md border border-line-soft">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Nyc311Pipeline execution history, most recent first</caption>
        <thead className="sticky top-0 bg-popover/95 backdrop-blur-sm">
          <tr className="border-b border-line text-left text-fg-subtle">
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
