import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useIntegrationTestReport } from "../../hooks/useIntegrationTestReport";
import type { RouteReportEntry } from "../../models/integrationTestReport";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

function StatusBadge({ entry }: { entry: RouteReportEntry }): ReactElement {
  if (!entry.hit) {
    return <span className="rounded-full bg-panel-hover px-2.5 py-1 text-xs font-medium text-fg-subtle">Not hit</span>;
  }
  if (entry.ok) {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-hue-emerald ring-1 ring-emerald-400/30">
        {entry.statusCode}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger ring-1 ring-red-400/30">
      {entry.statusCode ?? "error"}
    </span>
  );
}

/**
 * Route-hit visibility for the integration-test suite's most recent run
 * against the currently-serving environment — not a coverage gate
 * (5-pipeline-integration-tests.md §1/§4 explicitly declined that), just
 * which of the known GET routes got hit and whether each returned
 * success.
 */
export function IntegrationTestReportPage(): ReactElement {
  const { data, isPending, isError, error } = useIntegrationTestReport();

  return (
    <div className="relative min-h-full overflow-hidden bg-surface">
      <div aria-hidden="true" className="theme-aurora pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-40 -left-16 h-[26rem] w-[26rem] rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="animate-aurora-3 absolute -bottom-32 -right-24 h-[22rem] w-[22rem] rounded-full bg-sky-600/15 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_45%_at_50%_0%,black,transparent)]"
      />

      <main className={PAGE_CONTENT_CLASSES}>
        <Link to="/monitoring" className="text-sm font-medium text-fg-muted transition-colors hover:text-fg">
          &larr; Monitoring
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-hue-indigo via-hue-sky to-hue-cyan bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Integration Tests
        </h1>
        <p className="mt-2 text-fg-subtle">
          Which GET routes the integration-test suite reached on its most recent run, and whether each succeeded.
        </p>

        {isPending && <p className="mt-6 text-fg-subtle">Loading…</p>}

        {isError && (
          <p role="alert" className="mt-6 text-danger">
            Failed to load the integration-test report{error instanceof Error ? `: ${error.message}` : "."}
          </p>
        )}

        {!isPending && !isError && data && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="border-b border-line px-5 py-3 text-sm text-fg-subtle">
              target=<span className="text-fg">{data.target}</span> &middot; ran at{" "}
              <span className="text-fg">{new Date(data.ranAt).toLocaleString()}</span>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-fg-subtle">
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.routes).map(([route, entry]) => (
                  <tr key={route} className="border-t border-line-soft">
                    <td className="px-5 py-3 font-mono text-sm text-fg">{route}</td>
                    <td className="px-5 py-3">
                      <StatusBadge entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
