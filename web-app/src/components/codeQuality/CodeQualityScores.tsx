import type { ReactElement } from "react";
import type { CodeQualityReportSummary } from "../../models/codeQualityReport";
import { formatChange, formatRun, latestByPackage } from "./codeQualityFormat";

/** One tile per package: its latest score out of 100 and the change since its previous audit. */
export function CodeQualityScores({ reports }: { reports: readonly CodeQualityReportSummary[] }): ReactElement {
  return (
    <section aria-labelledby="code-quality-scores" className="mt-8">
      <h2 id="code-quality-scores" className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
        Latest score per package
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {latestByPackage(reports).map((report) => (
          <li key={report.package} className="rounded-xl border border-line bg-panel p-4 backdrop-blur">
            <p className="font-mono text-xs text-fg-muted">{report.package}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-fg">
              {report.score ?? "—"}
              <span className="text-sm font-medium text-fg-muted">/100</span>
            </p>
            <p className="mt-1 text-xs text-fg-subtle">{formatChange(report.score, report.previous)}</p>
            <p className="mt-2 text-[11px] text-fg-muted">{formatRun(report.date, report.time)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
