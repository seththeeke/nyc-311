import type { ReactElement } from "react";
import { usePublicApiMetrics } from "../../hooks/usePublicApiMetrics";
import type { PublicApiMetricsPoint } from "../../models/publicApiMetrics";
import { formatCompactNumber, niceMax } from "../ingestion/formatters";
import { IV_COLORS } from "../ingestion/palette";

const CHART_HEIGHT_PX = 96;

function formatMs(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} ms`;
}

function hourLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "numeric" });
}

function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <dt className="text-xs uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-fg">{value}</dd>
    </div>
  );
}

function HourBar({ point, axisMax }: { point: PublicApiMetricsPoint; axisMax: number }): ReactElement {
  const errors = point.client_errors + point.server_errors;
  const ok = Math.max(0, point.requests - errors);
  const label = `${hourLabel(point.timestamp)}: ${point.requests} requests, ${point.client_errors} 4xx, ${point.server_errors} 5xx, p50 ${formatMs(point.latency_p50_ms)}`;
  return (
    <li className="flex h-full flex-1 flex-col-reverse gap-[1px]" title={label} aria-label={label}>
      <span style={{ height: `${(ok / axisMax) * 100}%`, backgroundColor: IV_COLORS.statusGood }} className="rounded-sm" />
      <span style={{ height: `${(errors / axisMax) * 100}%`, backgroundColor: IV_COLORS.statusCritical }} className="rounded-sm" />
    </li>
  );
}

/** The public API's last 24 hours from API Gateway's built-in metrics (16-resident-action-models.md §6.2). */
export function PublicApiHealth(): ReactElement {
  const { data, isPending, isError, error } = usePublicApiMetrics();

  return (
    <section aria-labelledby="public-api-health" className="mt-6">
      <h2 id="public-api-health" className="text-xl font-bold text-fg">
        Health
      </h2>
      <p className="mt-1 text-sm text-fg-subtle">The last 24 hours, from API Gateway&apos;s own metrics.</p>

      {isPending && <p className="mt-4 text-fg-subtle">Loading…</p>}
      {isError && (
        <p role="alert" className="mt-4 text-danger">
          Failed to load public API metrics: {error.message}
        </p>
      )}
      {data && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Requests" value={formatCompactNumber(data.totals.requests)} />
            <Stat label="4xx" value={formatCompactNumber(data.totals.client_errors)} />
            <Stat label="5xx" value={formatCompactNumber(data.totals.server_errors)} />
            <Stat label="Latency p50" value={formatMs(data.totals.latency_p50_ms)} />
            <Stat label="Latency p99" value={formatMs(data.totals.latency_p99_ms)} />
          </dl>
          {data.totals.requests === 0 ? (
            <p className="mt-4 text-sm text-fg-subtle">No requests in the last 24 hours.</p>
          ) : (
            <div className="mt-4 rounded-lg border border-line bg-panel p-4">
              <h3 className="text-sm font-semibold text-fg">Requests per hour</h3>
              <ul aria-label="Requests per hour" className="mt-3 flex items-end gap-1" style={{ height: CHART_HEIGHT_PX }}>
                {data.points.map((point) => (
                  <HourBar key={point.timestamp} point={point} axisMax={niceMax(Math.max(...data.points.map((p) => p.requests), 1))} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
