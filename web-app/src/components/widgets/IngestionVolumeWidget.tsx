import type { ReactElement } from "react";
import { usePollerMetrics } from "../../hooks/usePollerMetrics";
import { IngestionVolumeMini } from "../ingestion/IngestionVolumeMini";

/**
 * A compact ingestion-volume chart for the secondary workspace. It calls the
 * same `usePollerMetrics` hook (same TanStack Query key) as the Ingestion
 * page, so the two share one cached response and one refetch timer — this
 * widget adds no backend calls of its own.
 */
export function IngestionVolumeWidget(): ReactElement {
  const { data, isPending, isError } = usePollerMetrics();

  if (isPending) return <p className="text-xs text-fg-subtle">Loading…</p>;
  if (isError) {
    return (
      <p role="alert" className="text-xs text-danger">
        Ingestion metrics unavailable.
      </p>
    );
  }
  if (data.metrics.length === 0) return <p className="text-xs text-fg-subtle">No poller runs recorded yet.</p>;
  return <IngestionVolumeMini metrics={data.metrics} />;
}
