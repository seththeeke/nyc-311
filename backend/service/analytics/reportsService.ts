import { logInfo } from "../../logger";
import { getJobResult } from "./jobResultService";
import type { GetJobResultDeps } from "./jobResultService";
import type { JobResult } from "../../models/jobResult";
import type { Report, ReportsResponse } from "../../models/report";

interface ReportJob {
  jobName: string;
  title: string;
}

/*
 * The registered reports (`7-data-warehousing.md` §12) — each is one
 * warehouse job whose latest resultset is a `(week, series, value)`
 * table. Adding a report is adding an entry here plus its `.sql` file.
 */
const REPORT_JOBS: ReportJob[] = [
  { jobName: "order_volume_by_stage_8w", title: "Order volume by stage — 8-week trend" },
];

export interface ListReportsDeps extends GetJobResultDeps {
  reportJobs?: ReportJob[];
}

/** Pivots a `(week, series, value)` resultset into a week-over-week trend. `null` if the shape isn't 3 columns. */
function toReport(job: ReportJob, result: JobResult): Report | null {
  if (result.columns.length < 3) return null;
  const [weekColumn, seriesColumn, valueColumn] = result.columns.map((c) => c.name);

  const byWeek = new Map<string, Record<string, number>>();
  const seriesValues = new Set<string>();
  for (const row of result.rows) {
    const week = row[weekColumn] ?? "";
    const series = row[seriesColumn] ?? "";
    seriesValues.add(series);
    const bucket = byWeek.get(week) ?? {};
    bucket[series] = Number(row[valueColumn] ?? "0");
    byWeek.set(week, bucket);
  }

  return {
    job_name: job.jobName,
    title: job.title,
    run_date: result.run_date,
    computed_at: result.computed_at,
    week_column: weekColumn,
    series_column: seriesColumn,
    value_column: valueColumn,
    series: [...seriesValues].sort(),
    weeks: [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, values]) => ({ week, values })),
  };
}

/**
 * Backs `GET /reports` (`7-data-warehousing.md` §12) — for each
 * registered report job, reads its latest `SUCCEEDED` run's resultset
 * from S3 (via `jobResultService`, no Athena on the read path) and
 * reshapes it into a week-over-week trend. A report whose job has never
 * produced a result, or whose resultset isn't a `(week, series, value)`
 * table, is simply omitted.
 */
export async function listReports(deps: ListReportsDeps = {}): Promise<ReportsResponse> {
  const reportJobs = deps.reportJobs ?? REPORT_JOBS;
  logInfo("ListReportsStarted", { reportJobs: reportJobs.map((j) => j.jobName) });

  const reports: Report[] = [];
  for (const job of reportJobs) {
    const result = await getJobResult(job.jobName, deps);
    if (!result) {
      logInfo("ListReportsJobHasNoResult", { jobName: job.jobName });
      continue;
    }
    const report = toReport(job, result);
    if (report) reports.push(report);
    else logInfo("ListReportsJobWrongShape", { jobName: job.jobName, columns: result.columns.length });
  }

  logInfo("ListReportsCompleted", { count: reports.length });
  return { reports };
}
