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
    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Success
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      Failed
    </span>
  );
}

export function PollerMetricsTable({ metrics }: PollerMetricsTableProps): ReactElement {
  return (
    <table className="mt-6 w-full border-collapse text-sm">
      <caption className="sr-only">NYC 311 poller run history, most recent first</caption>
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
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
          <tr key={metric.ran_at} className="border-b border-slate-100">
            <td className="py-2 pr-4 text-slate-700">{formatRanAt(metric.ran_at)}</td>
            <td className="py-2 pr-4">
              <StatusBadge success={metric.success} />
            </td>
            <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{metric.records_ingested}</td>
            <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{metric.duplicates_skipped}</td>
            <td className="py-2 pr-4 text-right tabular-nums text-slate-700">{metric.records_rejected}</td>
            <td className="py-2 text-slate-500">{metric.error_message ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
