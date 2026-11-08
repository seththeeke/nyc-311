import { Link, useParams } from "react-router-dom";
import { useRun, useRunLog } from "../../hooks/queries.ts";
import { LogView } from "../LogView.tsx";
import { QueryState } from "../QueryState.tsx";
import { ReportView } from "../ReportView.tsx";
import { RunFacts } from "../RunFacts.tsx";

/** One run: parsed facts, the agent's report, and the raw log (live while running). */
export function RunPage() {
  /* The route (agents/:agent/runs/:runId) always supplies both. */
  const { agent, runId } = useParams() as { agent: string; runId: string };
  const run = useRun(agent, runId);
  const log = useRunLog(agent, runId, run.data?.status === "RUNNING");
  return (
    <div className="space-y-6">
      <div>
        <Link to={`/agents/${agent}`} className="text-sm text-slate-400 hover:underline">← {agent}</Link>
        <h2 className="text-xl font-semibold">Run {runId}</h2>
      </div>
      <QueryState data={run.data} error={run.error}>
        {(detail) => (
          <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
            <RunFacts run={detail} />
            <section aria-labelledby="report-heading" className="space-y-2">
              <h3 id="report-heading" className="font-semibold">Report</h3>
              {detail.report ? <ReportView report={detail.report} /> : <p className="text-sm text-slate-400">No report for this run.</p>}
            </section>
          </div>
        )}
      </QueryState>
      <section aria-labelledby="log-heading" className="space-y-2">
        <h3 id="log-heading" className="font-semibold">Log{run.data?.status === "RUNNING" ? " (live)" : ""}</h3>
        <QueryState data={log.data} error={log.error}>
          {(chunk) => <LogView text={chunk.text} />}
        </QueryState>
      </section>
    </div>
  );
}
