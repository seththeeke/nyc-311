import type { RunStatus } from "../../shared/models/run.ts";

const STYLES: Record<RunStatus, string> = {
  RUNNING: "bg-sky-500/15 text-sky-300 ring-sky-500/40",
  SUCCEEDED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  FAILED: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
  SKIPPED: "bg-slate-500/15 text-slate-300 ring-slate-500/40",
  ABORTED: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ring-1 ${STYLES[status]}`}>{status}</span>;
}
