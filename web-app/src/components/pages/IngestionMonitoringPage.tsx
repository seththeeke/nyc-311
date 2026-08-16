import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { usePollerMetrics } from "../../hooks/usePollerMetrics";
import { PollerMetricsTable } from "../PollerMetricsTable";
import { IngestionStatTiles } from "../ingestion/IngestionStatTiles";
import { RunHistoryStrip } from "../ingestion/RunHistoryStrip";
import { IngestionVolumeChart } from "../ingestion/IngestionVolumeChart";

function Section({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function IngestionMonitoringPage(): ReactElement {
  const { data, isPending, isError, error } = usePollerMetrics();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/monitoring" className="text-sm text-blue-600 underline">
        &larr; Monitoring
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Ingestion</h1>
      <p className="mt-2 text-slate-600">NYC 311 poller run history.</p>

      {isPending && <p className="mt-6 text-slate-500">Loading…</p>}

      {isError && (
        <p role="alert" className="mt-6 text-red-700">
          Failed to load ingestion metrics{error instanceof Error ? `: ${error.message}` : "."}
        </p>
      )}

      {!isPending && !isError && data.length === 0 && (
        <p className="mt-6 text-slate-500">No poller runs recorded yet.</p>
      )}

      {!isPending && !isError && data.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <IngestionStatTiles metrics={data} />
          <Section title="Run history">
            <RunHistoryStrip metrics={data} />
          </Section>
          <Section title="Ingestion volume">
            <IngestionVolumeChart metrics={data} />
          </Section>
          <Section title="All runs">
            <PollerMetricsTable metrics={data} />
          </Section>
        </div>
      )}
    </main>
  );
}
