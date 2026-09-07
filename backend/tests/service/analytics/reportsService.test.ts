import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJobResult } from "../../../service/analytics/jobResultService";
import { listReports } from "../../../service/analytics/reportsService";
import type { JobResult } from "../../../models/jobResult";

vi.mock("../../../service/analytics/jobResultService", () => ({ getJobResult: vi.fn() }));
const mockedGetJobResult = vi.mocked(getJobResult);

function jobResult(rows: Record<string, string>[], columns = ["week_start", "stage", "order_count"]): JobResult {
  return {
    job_name: "order_volume_by_stage_8w",
    job_run_id: "01RUN",
    run_date: "2026-09-07",
    computed_at: "2026-09-07T14:16:36.410Z",
    columns: columns.map((name) => ({ name, type: "varchar" })),
    rows,
  };
}

beforeEach(() => {
  mockedGetJobResult.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listReports", () => {
  it("pivots a (week, series, value) resultset into a week-over-week trend, series and weeks sorted", async () => {
    mockedGetJobResult.mockResolvedValue(
      jobResult([
        { week_start: "2026-07-20", stage: "SCHEDULE", order_count: "41" },
        { week_start: "2026-07-13", stage: "SCHEDULE", order_count: "30" },
        { week_start: "2026-07-13", stage: "INGEST", order_count: "12" },
      ])
    );

    const { reports } = await listReports();

    expect(reports).toHaveLength(1);
    const report = reports[0];
    expect(report.job_name).toBe("order_volume_by_stage_8w");
    expect(report.title).toBe("Order volume by stage — 8-week trend");
    expect(report.week_column).toBe("week_start");
    expect(report.series_column).toBe("stage");
    expect(report.value_column).toBe("order_count");
    expect(report.series).toEqual(["INGEST", "SCHEDULE"]);
    expect(report.weeks).toEqual([
      { week: "2026-07-13", values: { SCHEDULE: 30, INGEST: 12 } },
      { week: "2026-07-20", values: { SCHEDULE: 41 } },
    ]);
  });

  it("omits a report whose job has never produced a result", async () => {
    mockedGetJobResult.mockResolvedValue(null);
    expect((await listReports()).reports).toEqual([]);
  });

  it("omits a report whose resultset isn't a 3-column (week, series, value) table", async () => {
    mockedGetJobResult.mockResolvedValue(jobResult([{ week_start: "2026-07-13", order_count: "1" }], ["week_start", "order_count"]));
    expect((await listReports()).reports).toEqual([]);
  });

  it("honours an injected report-jobs list and passes deps through to getJobResult", async () => {
    mockedGetJobResult.mockResolvedValue(jobResult([{ week_start: "2026-07-13", stage: "A", order_count: "5" }]));

    const { reports } = await listReports({ reportJobs: [{ jobName: "custom_job", title: "Custom" }] });

    expect(reports).toHaveLength(1);
    expect(reports[0].job_name).toBe("custom_job");
    expect(reports[0].title).toBe("Custom");
    expect(mockedGetJobResult).toHaveBeenCalledWith("custom_job", { reportJobs: [{ jobName: "custom_job", title: "Custom" }] });
  });

  it("tolerates a row missing the week / series / value column", async () => {
    mockedGetJobResult.mockResolvedValue(jobResult([{ irrelevant: "x" }]));

    const { reports } = await listReports();

    expect(reports[0].series).toEqual([""]);
    expect(reports[0].weeks).toEqual([{ week: "", values: { "": 0 } }]);
  });
});
