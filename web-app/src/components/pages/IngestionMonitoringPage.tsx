import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { usePollerMetrics } from "../../hooks/usePollerMetrics";
import { PollerMetricsTable } from "../PollerMetricsTable";
import { IngestionStatTiles } from "../ingestion/IngestionStatTiles";
import { RunHistoryStrip } from "../ingestion/RunHistoryStrip";
import { IngestionVolumeChart } from "../ingestion/IngestionVolumeChart";
import { CursorStatusCard } from "../ingestion/CursorStatusCard";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

function Section({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4 shadow-2xl shadow-cyan-950/20 ring-1 ring-line">
      <h2 className="text-sm font-semibold tracking-wide text-fg uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function IngestionMonitoringPage(): ReactElement {
  const { data, isPending, isError, error } = usePollerMetrics();

  return (
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -right-16 h-[26rem] w-[26rem] rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="animate-aurora-3 absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-blue-600/15 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_45%_at_50%_0%,black,transparent)]"
      />

      <main className={PAGE_CONTENT_CLASSES}>
        <Link to="/monitoring" className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
          &larr; Monitoring
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-hue-cyan via-hue-blue to-hue-violet bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Ingestion
        </h1>
        <p className="mt-2 text-fg-subtle">NYC 311 poller run history.</p>

        {isPending && <p className="mt-6 text-fg-subtle">Loading…</p>}

        {isError && (
          <p role="alert" className="mt-6 text-danger">
            Failed to load ingestion metrics{error instanceof Error ? `: ${error.message}` : "."}
          </p>
        )}

        {!isPending && !isError && (
          <div className="mt-6 flex flex-col gap-4">
            <Section title="Ingestion cursor">
              <CursorStatusCard cursor={data.cursor} />
            </Section>

            {data.metrics.length === 0 && <p className="text-fg-subtle">No poller runs recorded yet.</p>}

            {data.metrics.length > 0 && (
              <>
                <IngestionStatTiles metrics={data.metrics} />
                <Section title="Run history">
                  <RunHistoryStrip metrics={data.metrics} />
                </Section>
                <Section title="Ingestion volume">
                  <IngestionVolumeChart metrics={data.metrics} />
                </Section>
                <Section title="All runs">
                  <PollerMetricsTable metrics={data.metrics} />
                </Section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
