import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { usePipelineStatus } from "../../hooks/usePipelineStatus";
import { PipelineStagesView } from "../pipeline/PipelineStagesView";
import { PipelineExecutionHistory } from "../pipeline/PipelineExecutionHistory";

function Section({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PipelineMonitoringPage(): ReactElement {
  const { data, isPending, isError, error } = usePipelineStatus();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/monitoring" className="text-sm text-blue-600 underline">
        &larr; Monitoring
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Pipeline</h1>
      <p className="mt-2 text-slate-600">Nyc311Pipeline status — read-only, refreshes every 30s.</p>

      {isPending && <p className="mt-6 text-slate-500">Loading…</p>}

      {isError && (
        <p role="alert" className="mt-6 text-red-700">
          Failed to load pipeline status{error instanceof Error ? `: ${error.message}` : "."}
        </p>
      )}

      {!isPending && !isError && data.stages.length === 0 && (
        <p className="mt-6 text-slate-500">No pipeline state available yet.</p>
      )}

      {!isPending && !isError && data.stages.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <Section title="Stages">
            <PipelineStagesView stages={data.stages} />
          </Section>
          <Section title="Execution history">
            <PipelineExecutionHistory executions={data.executions} />
          </Section>
        </div>
      )}
    </main>
  );
}
