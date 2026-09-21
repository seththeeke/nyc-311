import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { usePipelineStatus } from "../../hooks/usePipelineStatus";
import { PipelineStagesView } from "../pipeline/PipelineStagesView";
import { PipelineExecutionHistory } from "../pipeline/PipelineExecutionHistory";
import { PipelineBuildDurationChart } from "../pipeline/PipelineBuildDurationChart";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

const GITHUB_REPO_URL = "https://github.com/seththeeke/nyc-311";

function Section({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 shadow-2xl shadow-violet-950/20 ring-1 ring-line">
      <h2 className="text-sm font-semibold tracking-wide text-fg uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PipelineMonitoringPage(): ReactElement {
  const { data, isPending, isError, error } = usePipelineStatus();

  return (
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-2 absolute -top-40 right-0 h-[26rem] w-[26rem] rounded-full bg-violet-600/25 blur-3xl" />
        <div className="animate-aurora-1 absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-blue-600/15 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_45%_at_50%_0%,black,transparent)]"
      />

      <main className={PAGE_CONTENT_CLASSES}>
        <div className="flex items-center justify-between">
          <Link to="/monitoring" className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
            &larr; Monitoring
          </Link>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line bg-panel px-3 py-1 text-sm font-medium text-fg-muted backdrop-blur transition-colors hover:border-violet-400/40 hover:text-fg"
          >
            View on GitHub<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <h1 className="mt-4 bg-gradient-to-r from-hue-violet via-hue-blue to-hue-cyan bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Pipeline
        </h1>
        <p className="mt-2 text-fg-subtle">Nyc311Pipeline status — read-only, refreshes every 30s.</p>

        {isPending && <p className="mt-6 text-fg-subtle">Loading…</p>}

        {isError && (
          <p role="alert" className="mt-6 text-danger">
            Failed to load pipeline status{error instanceof Error ? `: ${error.message}` : "."}
          </p>
        )}

        {!isPending && !isError && data.stages.length === 0 && (
          <p className="mt-6 text-fg-subtle">No pipeline state available yet.</p>
        )}

        {!isPending && !isError && data.stages.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            <Section title="Stages">
              <PipelineStagesView stages={data.stages} />
            </Section>
            <Section title="Build duration">
              <PipelineBuildDurationChart executions={data.executions} />
            </Section>
            <Section title="Execution history">
              <PipelineExecutionHistory executions={data.executions} />
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}
