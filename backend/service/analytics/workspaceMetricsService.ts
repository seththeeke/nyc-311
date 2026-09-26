import { logInfo, logWarn } from "../../logger";
import type { JobResult } from "../../models/jobResult";
import type { WorkspaceMetricId, WorkspaceMetrics, WorkspaceMetricValue } from "../../models/workspaceMetrics";
import { getJobResult } from "./jobResultService";

/** The weekly business report job — one row per `week_start`. */
export const WBR_JOB_NAME = "wbr";

const WEEK_START_COLUMN = "week_start";

/**
 * Which `wbr` column feeds each workspace metric. Adding a tile's metric
 * means adding its column to the job's SQL, then one entry here (plus its
 * id in `models/workspaceMetrics.ts`).
 */
export const METRIC_COLUMNS: Record<WorkspaceMetricId, string> = {
  REQUESTS_ACCEPTED: "orders_accepted",
  SERVICED: "orders_resolved",
  MEAN_TIME_TO_RESOLVE_HOURS: "avg_resolution_hours",
  MEDIAN_TIME_TO_RESOLVE_HOURS: "median_resolution_hours",
  /* Not in the report yet — reads as null until the job's SQL adds it. */
  TOTAL_COST: "total_cost",
};

type ReportRow = Record<string, string>;

export interface GetWorkspaceMetricsDeps {
  loadJobResult?: (jobName: string) => Promise<JobResult | null>;
}

/* Athena returns every value as a string; a blank cell is "no value", not 0. */
function parseNumber(row: ReportRow | undefined, column: string): number | null {
  const raw = row?.[column];
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    logWarn("WorkspaceMetricsUnparseableValue", { column, raw, weekStart: row?.[WEEK_START_COLUMN] });
    return null;
  }
  return value;
}

function emptyMetrics(): Record<WorkspaceMetricId, WorkspaceMetricValue> {
  return {
    REQUESTS_ACCEPTED: { current: null, previous: null },
    SERVICED: { current: null, previous: null },
    MEAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
    MEDIAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
    TOTAL_COST: { current: null, previous: null },
  };
}

/**
 * Backs `GET /workspace/metrics` — reads the latest `wbr` run and returns
 * its most recent week plus the week before, per metric in
 * {@link METRIC_COLUMNS}. Rows without a `week_start` are skipped. A
 * missing column, no run yet, or an empty run yields null values for the
 * affected metrics, not an error.
 */
export async function getWorkspaceMetrics(deps: GetWorkspaceMetricsDeps = {}): Promise<WorkspaceMetrics> {
  const loadJobResult = deps.loadJobResult ?? getJobResult;

  logInfo("GetWorkspaceMetricsStarted", { jobName: WBR_JOB_NAME });

  const result = await loadJobResult(WBR_JOB_NAME);
  if (!result) {
    logInfo("GetWorkspaceMetricsNoResult", { jobName: WBR_JOB_NAME });
    return {
      source_job: WBR_JOB_NAME,
      job_run_id: null,
      computed_at: null,
      week_start: null,
      previous_week_start: null,
      metrics: emptyMetrics(),
    };
  }

  /* A missing column degrades that metric to null rather than failing the whole response. */
  const reportColumns = new Set(result.columns.map((column) => column.name));
  const missingColumns = Object.values(METRIC_COLUMNS).filter((column) => !reportColumns.has(column));
  if (missingColumns.length > 0) {
    logWarn("WorkspaceMetricsColumnsMissing", { jobRunId: result.job_run_id, missingColumns });
  }

  const weeks = result.rows.filter((row) => {
    const hasWeek = (row[WEEK_START_COLUMN] ?? "").trim() !== "";
    if (!hasWeek) logWarn("WorkspaceMetricsRowMissingWeekStart", { jobRunId: result.job_run_id, row });
    return hasWeek;
  });
  /* ISO dates sort lexically — newest first. */
  weeks.sort((a, b) => b[WEEK_START_COLUMN].localeCompare(a[WEEK_START_COLUMN]));
  const [latest, previous] = weeks;

  const metrics = emptyMetrics();
  for (const id of Object.keys(METRIC_COLUMNS) as WorkspaceMetricId[]) {
    metrics[id] = { current: parseNumber(latest, METRIC_COLUMNS[id]), previous: parseNumber(previous, METRIC_COLUMNS[id]) };
  }

  const response: WorkspaceMetrics = {
    source_job: WBR_JOB_NAME,
    job_run_id: result.job_run_id,
    computed_at: result.computed_at,
    week_start: latest?.[WEEK_START_COLUMN] ?? null,
    previous_week_start: previous?.[WEEK_START_COLUMN] ?? null,
    metrics,
  };
  logInfo("GetWorkspaceMetricsCompleted", {
    jobRunId: result.job_run_id,
    rowCount: result.rows.length,
    weekStart: response.week_start,
    previousWeekStart: response.previous_week_start,
    metrics,
  });
  return response;
}
