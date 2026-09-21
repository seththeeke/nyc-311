import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useWarehouseSchema } from "../../hooks/useWarehouseSchema";
import { WarehouseSchemaSearch } from "../data/WarehouseSchemaSearch";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

/** Rendered only while the query is pending or errored — a not-pending state here is therefore an error. */
function QueryState({ isPending, error }: { isPending: boolean; error: unknown }): ReactElement {
  if (isPending) return <p className="text-fg-subtle">Loading…</p>;
  return (
    <p role="alert" className="text-danger">
      Failed to load warehouse schema
      {error instanceof Error ? `: ${error.message}` : "."}
    </p>
  );
}

/**
 * The data warehouse's public, read-only surface (7-data-warehousing.md
 * §12) — just the schema, searchable client-side. No write actions exist
 * here or on any route this page reaches. Only reachable today via the
 * Monitoring page's "Data Modeling" tile, so its back link returns there
 * rather than to Home.
 */
export function DataPage(): ReactElement {
  const schemaQuery = useWarehouseSchema();

  return (
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -left-16 h-[26rem] w-[26rem] rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="animate-aurora-2 absolute -bottom-32 -right-24 h-[22rem] w-[22rem] rounded-full bg-blue-600/15 blur-3xl" />
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
          Data
        </h1>
        <p className="mt-2 text-fg-subtle">The warehouse's schema — search by table or column name. Read-only.</p>

        <section aria-label="Warehouse schema" className="mt-6">
          {schemaQuery.isPending || schemaQuery.isError ? (
            <QueryState isPending={schemaQuery.isPending} error={schemaQuery.error} />
          ) : schemaQuery.data.tables.length === 0 ? (
            <p className="text-fg-subtle">No warehouse tables catalogued yet.</p>
          ) : (
            <WarehouseSchemaSearch tables={schemaQuery.data.tables} />
          )}
        </section>
      </main>
    </div>
  );
}
