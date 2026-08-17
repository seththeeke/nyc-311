import type { ReactElement } from "react";
import type { PipelineExecution } from "../../models/pipelineStatus";
import { formatDuration, formatRelativeTime } from "./formatters";
import { getStatusVisual } from "./pipelineStatusVisuals";
import { PipelineStatusIcon } from "./PipelineStatusIcon";

export interface PipelineExecutionHistoryProps {
  executions: PipelineExecution[];
}

function ExecutionRow({ execution }: { execution: PipelineExecution }): ReactElement {
  const visual = getStatusVisual(execution.status);
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-4">
        {execution.commitMessage ? (
          <span className="text-slate-700" title={execution.commitId ?? undefined}>
            {execution.commitMessage}
          </span>
        ) : (
          // A StartPipelineExecution-triggered restart (self-mutation),
          // not a push — genuinely has no commit to show, not a data gap.
          <span className="text-slate-400 italic">Pipeline restart (no commit)</span>
        )}
      </td>
      <td className="py-2 pr-4">
        <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: visual.color }}>
          <PipelineStatusIcon category={visual.category} className="h-3.5 w-3.5" style={{ color: visual.color }} />
          {visual.label}
        </span>
      </td>
      <td className="py-2 pr-4 text-slate-500">
        {execution.startTime ? formatRelativeTime(execution.startTime) : "—"}
      </td>
      <td className="py-2 text-right tabular-nums text-slate-500">
        {execution.startTime ? formatDuration(execution.startTime, execution.lastUpdateTime) : "—"}
      </td>
    </tr>
  );
}

// The execution-history list is itself the accessible table-view
// equivalent here (dataviz skill) — no separate twin needed, unlike a
// chart, since this already renders as a real <table>.
export function PipelineExecutionHistory({ executions }: PipelineExecutionHistoryProps): ReactElement {
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <caption className="sr-only">Nyc311Pipeline execution history, most recent first</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th scope="col" className="py-2 pr-4 font-medium">Commit</th>
          <th scope="col" className="py-2 pr-4 font-medium">Status</th>
          <th scope="col" className="py-2 pr-4 font-medium">Started</th>
          <th scope="col" className="py-2 text-right font-medium">Duration</th>
        </tr>
      </thead>
      <tbody>
        {executions.map((execution) => (
          <ExecutionRow key={execution.executionId} execution={execution} />
        ))}
      </tbody>
    </table>
  );
}
