import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useWarehouseSchema } from "../../hooks/useWarehouseSchema";
import { useWarehouseJobRuns } from "../../hooks/useWarehouseJobRuns";
import { WarehouseSchemaView } from "../data/WarehouseSchemaView";
import { DataViewTabs, dataViewPanelId, dataViewTabId, type DataView } from "../data/DataViewTabs";
import { JobsView } from "../data/JobsView";
import { PerformanceView } from "../data/PerformanceView";

const CARD_CLASSES =
  "rounded-2xl border border-white/10 bg-white shadow-2xl shadow-cyan-950/20 ring-1 ring-black/5";

function Section({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <section className={`${CARD_CLASSES} p-4`}>
      <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Rendered only while a query is pending or errored — a not-pending state here is therefore an error. */
function QueryState({ isPending, error, label }: { isPending: boolean; error: unknown; label: string }): ReactElement {
  if (isPending) return <p className="text-slate-500">Loading…</p>;
  return (
    <p role="alert" className="text-red-600">
      Failed to load {label}
      {error instanceof Error ? `: ${error.message}` : "."}
    </p>
  );
}

/**
 * The data warehouse's public, read-only surface (7-data-warehousing.md
 * §12) — schema on the left, the job runner's history (or its query
 * performance) on the right. Deliberately not nested under /monitoring.
 * No write actions exist here or on any route this page reaches.
 */
export function DataPage(): ReactElement {
  const schemaQuery = useWarehouseSchema();
  const jobRunsQuery = useWarehouseJobRuns();
  const [view, setView] = useState<DataView>("jobs");

  const jobRuns = jobRunsQuery.data?.jobRuns ?? [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -left-16 h-[26rem] w-[26rem] rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="animate-aurora-2 absolute -bottom-32 -right-24 h-[22rem] w-[22rem] rounded-full bg-blue-600/15 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_45%_at_50%_0%,black,transparent)]"
      />

      <main className="relative mx-auto max-w-7xl px-6 py-16">
        <Link to="/" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
          &larr; Home
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Data
        </h1>
        <p className="mt-2 text-slate-400">
          The warehouse's schema and job history — read-only, refreshes every 30s.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Section title="Schema">
              {schemaQuery.isPending || schemaQuery.isError ? (
                <QueryState isPending={schemaQuery.isPending} error={schemaQuery.error} label="warehouse schema" />
              ) : schemaQuery.data.tables.length === 0 ? (
                <p className="text-slate-500">No warehouse tables catalogued yet.</p>
              ) : (
                <WarehouseSchemaView tables={schemaQuery.data.tables} />
              )}
            </Section>
          </div>

          <div className={`lg:col-span-3 ${CARD_CLASSES}`}>
            <DataViewTabs view={view} onChange={setView} />
            <div id={dataViewPanelId(view)} role="tabpanel" aria-labelledby={dataViewTabId(view)} className="p-4">
              {jobRunsQuery.isPending || jobRunsQuery.isError ? (
                <QueryState isPending={jobRunsQuery.isPending} error={jobRunsQuery.error} label="job runs" />
              ) : view === "jobs" ? (
                <JobsView jobRuns={jobRuns} />
              ) : (
                <PerformanceView jobRuns={jobRuns} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
