import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useReports } from "../../hooks/useReports";
import { ReportTrendTable } from "../reports/ReportTrendTable";

/**
 * The centralized reporting page (7-data-warehousing.md §12) — behind the
 * Monitoring "Reports" tile. Reads GET /reports, which materializes each
 * registered warehouse job's latest resultset into a week-over-week
 * trend. Read-only, and deliberately decoupled from the warehouse/job
 * layer: adding a report is a backend concern, this page just renders
 * whatever the endpoint returns.
 */
export function ReportsPage(): ReactElement {
  const { data, isPending, isError, error } = useReports();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -left-16 h-[26rem] w-[26rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="animate-aurora-3 absolute -bottom-32 -right-24 h-[22rem] w-[22rem] rounded-full bg-teal-600/15 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_45%_at_50%_0%,black,transparent)]"
      />

      <main className="relative mx-auto max-w-3xl px-6 py-16">
        <Link to="/monitoring" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
          &larr; Monitoring
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Reports
        </h1>
        <p className="mt-2 text-slate-400">
          Week-over-week trends assembled from the data warehouse&rsquo;s daily job runs — one card per registered
          report.
        </p>

        {isPending && <p className="mt-6 text-slate-400">Loading…</p>}

        {isError && (
          <p role="alert" className="mt-6 text-red-400">
            Failed to load reports{error instanceof Error ? `: ${error.message}` : "."}
          </p>
        )}

        {!isPending && !isError && data && data.reports.length === 0 && (
          <p className="mt-6 text-slate-400">No reports have produced a result yet.</p>
        )}

        {!isPending && !isError && data && data.reports.length > 0 && (
          <div className="mt-6 space-y-6">
            {data.reports.map((report) => (
              <ReportTrendTable key={report.job_name} report={report} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
