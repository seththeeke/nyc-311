import type { RunDetail } from "../../shared/models/runDetail.ts";
import { StatusBadge } from "./StatusBadge.tsx";
import { formatDuration, formatElapsed, formatWhen } from "./format.ts";

/** The parsed facts of one run. */
export function RunFacts({ run }: { run: RunDetail }) {
  const rows: [string, string | null][] = [
    ["Trigger", run.manual ? "Manual (Run button)" : "Schedule"],
    ["Mode", run.mode],
    ["Model", run.model],
    ["Started", formatWhen(run.startedAt)],
    ["Duration", run.status === "RUNNING" ? `${formatElapsed(run.startedAt)} so far` : formatDuration(run.durationSeconds)],
    ["Exit code", run.exitCode === null ? null : String(run.exitCode)],
    ["Chat post", run.chatPostId],
    ["Open PRs before", run.openPrsBefore],
    ["Open PRs after", run.openPrsAfter],
    ["Error", run.error],
  ];
  return (
    <div className="space-y-3">
      <StatusBadge status={run.status} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.filter(([, value]) => value !== null).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-400">{label}</dt>
            <dd className="font-mono text-xs leading-5">{value}</dd>
          </div>
        ))}
      </dl>
      {run.warnings.length > 0 && (
        <ul className="list-inside list-disc text-sm text-amber-300">
          {run.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      )}
    </div>
  );
}
