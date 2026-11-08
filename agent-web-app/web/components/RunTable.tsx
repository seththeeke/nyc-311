import { Link } from "react-router-dom";
import type { RunSummary } from "../../shared/models/run.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { formatDuration, formatWhen } from "./format.ts";

/** An agent's run history, newest first. */
export function RunTable({ runs }: { runs: RunSummary[] }) {
  if (runs.length === 0) return <p className="text-slate-400">No runs yet.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-400">
        <tr>
          <th className="py-1 pr-3 font-normal">Started</th>
          <th className="py-1 pr-3 font-normal">Status</th>
          <th className="py-1 pr-3 font-normal">Mode</th>
          <th className="py-1 pr-3 font-normal">Duration</th>
          <th className="py-1 font-normal">Notes</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.runId} className="border-t border-slate-800">
            <td className="py-1 pr-3">
              <Link to={`/agents/${run.agent}/runs/${run.runId}`} className="hover:underline">{formatWhen(run.startedAt)}</Link>
            </td>
            <td className="py-1 pr-3"><StatusBadge status={run.status} /></td>
            <td className="py-1 pr-3">{run.mode ?? "—"}{run.model ? ` · ${run.model}` : ""}</td>
            <td className="py-1 pr-3">{formatDuration(run.durationSeconds)}</td>
            <td className="py-1 text-slate-400">{run.error ?? (run.warnings.length > 0 ? `${run.warnings.length} warning(s)` : "")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
