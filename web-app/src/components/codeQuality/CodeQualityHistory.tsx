import type { ReactElement } from "react";
import type { CodeQualityReportSummary } from "../../models/codeQualityReport";
import { formatChange, formatRun, reportId } from "./codeQualityFormat";

interface CodeQualityHistoryProps {
  reports: readonly CodeQualityReportSummary[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/** Every report, newest first, as a table: the trend across audits, and the way to open one. */
export function CodeQualityHistory({ reports, selectedId, onSelect }: CodeQualityHistoryProps): ReactElement {
  return (
    <section aria-labelledby="code-quality-history" className="mt-10">
      <h2 id="code-quality-history" className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
        Reports
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-panel backdrop-blur">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Run</th>
              <th scope="col" className="px-4 py-2 font-medium">Package</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Score</th>
              <th scope="col" className="px-4 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const id = reportId(report);
              const selected = id === selectedId;
              return (
                <tr key={id} className={`border-t border-line ${selected ? "bg-panel-strong" : ""}`}>
                  <td className="px-4 py-2">
                    <button type="button" aria-pressed={selected} onClick={() => onSelect(id)} className="text-left font-medium text-hue-cyan hover:underline">
                      {formatRun(report.date, report.time)}
                    </button>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-fg-subtle">{report.package}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-fg">{report.score ?? "—"}</td>
                  <td className="px-4 py-2 text-fg-subtle">{formatChange(report.score, report.previous)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
