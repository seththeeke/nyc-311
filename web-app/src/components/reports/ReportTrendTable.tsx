import type { ReactElement } from "react";
import type { Report } from "../../models/report";

export interface ReportTrendTableProps {
  report: Report;
}

/**
 * One report (7-data-warehousing.md §12) rendered as a week × series
 * matrix: one row per week bucket, one column per series value, with a
 * per-week total column and a per-series total row. The reporting layer
 * owns this presentation; the warehouse/job layer knows nothing about it.
 */
export function ReportTrendTable({ report }: ReportTrendTableProps): ReactElement {
  const cell = (week: { values: Record<string, number> }, series: string): number => week.values[series] ?? 0;
  const weekTotal = (week: { values: Record<string, number> }): number =>
    report.series.reduce((sum, s) => sum + cell(week, s), 0);
  const seriesTotal = (series: string): number => report.weeks.reduce((sum, w) => sum + cell(w, series), 0);
  const grandTotal = report.weeks.reduce((sum, w) => sum + weekTotal(w), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-100">{report.title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {report.job_name} &middot; run {report.run_date} &middot; computed{" "}
          {new Date(report.computed_at).toLocaleString()}
        </p>
      </div>

      {report.weeks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">The latest run produced no weeks yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              {report.title} — {report.value_column} by {report.week_column} and {report.series_column}
            </caption>
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-400">
                <th scope="col" className="px-5 py-3 text-left font-medium">
                  {report.week_column}
                </th>
                {report.series.map((series) => (
                  <th key={series} scope="col" className="px-4 py-3 text-right font-medium">
                    {series}
                  </th>
                ))}
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {report.weeks.map((week) => (
                <tr key={week.week} className="border-b border-white/5">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal tabular-nums text-slate-300">
                    {week.week}
                  </th>
                  {report.series.map((series) => {
                    const n = cell(week, series);
                    return (
                      <td
                        key={series}
                        className={`px-4 py-2.5 text-right tabular-nums ${n === 0 ? "text-slate-600" : "text-slate-200"}`}
                      >
                        {n === 0 ? "–" : n.toLocaleString()}
                      </td>
                    );
                  })}
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums text-white">
                    {weekTotal(week).toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-white/[0.03] font-medium">
                <th scope="row" className="px-5 py-2.5 text-left text-slate-400">
                  Total
                </th>
                {report.series.map((series) => (
                  <td key={series} className="px-4 py-2.5 text-right tabular-nums text-slate-200">
                    {seriesTotal(series).toLocaleString()}
                  </td>
                ))}
                <td className="px-5 py-2.5 text-right tabular-nums text-white">{grandTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
