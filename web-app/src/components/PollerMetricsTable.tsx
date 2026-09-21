import type { ReactElement } from "react";
import type { PollerMetrics } from "../models/pollerMetrics";

export interface PollerMetricsTableProps {
  metrics: PollerMetrics[];
}

function formatRanAt(ranAt: string): string {
  return new Date(ranAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ success }: { success: boolean }): ReactElement {
  return success ? (
    <span className="inline-flex rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-hue-emerald">
      Success
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
      Failed
    </span>
  );
}

export function PollerMetricsTable({ metrics }: PollerMetricsTableProps): ReactElement {
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <caption className="sr-only">NYC 311 poller run history, most recent first</caption>
      <thead>
        <tr className="border-b border-line text-left text-fg-subtle">
          <th scope="col" className="py-2 pr-4 font-medium">Run</th>
          <th scope="col" className="py-2 pr-4 font-medium">Status</th>
          <th scope="col" className="py-2 pr-4 text-right font-medium">Ingested</th>
          <th scope="col" className="py-2 pr-4 text-right font-medium">Duplicates</th>
          <th scope="col" className="py-2 pr-4 text-right font-medium">Rejected</th>
          <th scope="col" className="py-2 font-medium">Error</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((metric) => (
          <tr key={metric.ran_at} className="border-b border-line-soft">
            <td className="py-2 pr-4 text-fg-muted">{formatRanAt(metric.ran_at)}</td>
            <td className="py-2 pr-4">
              <StatusBadge success={metric.success} />
            </td>
            <td className="py-2 pr-4 text-right tabular-nums text-fg-muted">{metric.records_ingested}</td>
            <td className="py-2 pr-4 text-right tabular-nums text-fg-muted">{metric.duplicates_skipped}</td>
            <td className="py-2 pr-4 text-right tabular-nums text-fg-muted">{metric.records_rejected}</td>
            <td className="py-2 text-fg-subtle">{metric.error_message ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
