import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceMetrics, WBR_JOB_NAME } from "../../../service/analytics/workspaceMetricsService";
import { getJobResult } from "../../../service/analytics/jobResultService";
import { WorkspaceMetricsSchema } from "../../../models/workspaceMetrics";
import type { JobResult } from "../../../models/jobResult";

vi.mock("../../../service/analytics/jobResultService", () => ({ getJobResult: vi.fn() }));
const mockedGetJobResult = vi.mocked(getJobResult);

const COLUMNS = [
  "week_start",
  "orders_created",
  "orders_accepted",
  "orders_resolved",
  "avg_resolution_hours",
  "median_resolution_hours",
  "operators_live",
  "total_cost",
].map((name) => ({ name, type: name === "week_start" ? "date" : "double" }));

function row(week: string, resolved: string, avg: string, median: string, accepted = "50"): Record<string, string> {
  return {
    week_start: week,
    orders_created: "100",
    orders_accepted: accepted,
    orders_resolved: resolved,
    avg_resolution_hours: avg,
    median_resolution_hours: median,
    operators_live: "70",
    total_cost: "1000.5",
  };
}

function wbr(rows: Record<string, string>[]): JobResult {
  return { job_name: "wbr", job_run_id: "01WBR", run_date: "2026-09-26", computed_at: "2026-09-26T06:00:00.000Z", columns: COLUMNS, rows };
}

beforeEach(() => {
  mockedGetJobResult.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWorkspaceMetrics", () => {
  it("returns the latest week and the week before it, per metric, regardless of row order", async () => {
    const loadJobResult = vi.fn().mockResolvedValue(
      wbr([
        row("2026-09-14", "832", "115.42", "5.28", "8635"),
        row("2026-09-21", "411", "1.02", "0.95", "411"),
        row("2026-09-07", "290", "332.65", "332.62", "52073"),
      ])
    );

    const result = await getWorkspaceMetrics({ loadJobResult });

    expect(loadJobResult).toHaveBeenCalledWith(WBR_JOB_NAME);
    expect(result).toEqual({
      source_job: "wbr",
      job_run_id: "01WBR",
      computed_at: "2026-09-26T06:00:00.000Z",
      week_start: "2026-09-21",
      previous_week_start: "2026-09-14",
      metrics: {
        REQUESTS_ACCEPTED: { current: 411, previous: 8635 },
        SERVICED: { current: 411, previous: 832 },
        MEAN_TIME_TO_RESOLVE_HOURS: { current: 1.02, previous: 115.42 },
        MEDIAN_TIME_TO_RESOLVE_HOURS: { current: 0.95, previous: 5.28 },
        TOTAL_COST: { current: 1000.5, previous: 1000.5 },
      },
    });
    expect(() => WorkspaceMetricsSchema.parse(result)).not.toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("treats blank and unparseable cells as null, not 0", async () => {
    const loadJobResult = vi.fn().mockResolvedValue(
      wbr([row("2026-08-24", "0", "", " "), row("2026-08-17", "abc", "", "")])
    );

    const result = await getWorkspaceMetrics({ loadJobResult });

    expect(result.metrics).toEqual({
      REQUESTS_ACCEPTED: { current: 50, previous: 50 },
      SERVICED: { current: 0, previous: null },
      MEAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
      MEDIAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
      TOTAL_COST: { current: 1000.5, previous: 1000.5 },
    });
  });

  it("degrades only the metrics whose column the report doesn't have (e.g. total_cost before it's added)", async () => {
    const withoutCost = wbr([row("2026-09-21", "411", "1.02", "0.95"), row("2026-09-14", "832", "115.42", "5.28")]);
    withoutCost.columns = withoutCost.columns.filter((column) => column.name !== "total_cost");
    withoutCost.rows = withoutCost.rows.map((r) => {
      const copy = { ...r };
      delete copy.total_cost;
      return copy;
    });

    const result = await getWorkspaceMetrics({ loadJobResult: vi.fn().mockResolvedValue(withoutCost) });

    expect(result.metrics.TOTAL_COST).toEqual({ current: null, previous: null });
    expect(result.metrics.SERVICED).toEqual({ current: 411, previous: 832 });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("WorkspaceMetricsColumnsMissing"));
  });

  it("treats a missing column as null", async () => {
    const loadJobResult = vi.fn().mockResolvedValue(wbr([{ week_start: "2026-09-21" }]));

    const result = await getWorkspaceMetrics({ loadJobResult });

    expect(result.week_start).toBe("2026-09-21");
    expect(result.previous_week_start).toBeNull();
    expect(result.metrics.SERVICED).toEqual({ current: null, previous: null });
  });

  it("skips rows with no week_start", async () => {
    const loadJobResult = vi.fn().mockResolvedValue(
      wbr([row("", "999", "9", "9"), { orders_resolved: "5" }, row("2026-09-21", "411", "1.02", "0.95")])
    );

    const result = await getWorkspaceMetrics({ loadJobResult });

    expect(result.week_start).toBe("2026-09-21");
    expect(result.previous_week_start).toBeNull();
    expect(result.metrics.SERVICED).toEqual({ current: 411, previous: null });
  });

  it("returns all-null values when the job has no rows", async () => {
    const result = await getWorkspaceMetrics({ loadJobResult: vi.fn().mockResolvedValue(wbr([])) });

    expect(result.job_run_id).toBe("01WBR");
    expect(result.week_start).toBeNull();
    expect(result.metrics.MEDIAN_TIME_TO_RESOLVE_HOURS).toEqual({ current: null, previous: null });
  });

  it("returns all-null values when the job has never produced a result", async () => {
    const result = await getWorkspaceMetrics({ loadJobResult: vi.fn().mockResolvedValue(null) });

    expect(result).toEqual({
      source_job: "wbr",
      job_run_id: null,
      computed_at: null,
      week_start: null,
      previous_week_start: null,
      metrics: {
        REQUESTS_ACCEPTED: { current: null, previous: null },
        SERVICED: { current: null, previous: null },
        MEAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
        MEDIAN_TIME_TO_RESOLVE_HOURS: { current: null, previous: null },
        TOTAL_COST: { current: null, previous: null },
      },
    });
  });

  it("defaults to jobResultService.getJobResult", async () => {
    mockedGetJobResult.mockResolvedValue(wbr([row("2026-09-21", "411", "1.02", "0.95")]));

    const result = await getWorkspaceMetrics();

    expect(mockedGetJobResult).toHaveBeenCalledWith("wbr");
    expect(result.metrics.SERVICED.current).toBe(411);
  });

  it("propagates a failure to load the job result", async () => {
    const loadJobResult = vi.fn().mockRejectedValue(new Error("S3 down"));

    await expect(getWorkspaceMetrics({ loadJobResult })).rejects.toThrow("S3 down");
  });
});
