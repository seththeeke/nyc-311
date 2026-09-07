import { describe, expect, it } from "vitest";
import { ReportSchema, ReportsResponseSchema, ReportWeekSchema } from "../../src/models/report";

const validReport = {
  job_name: "order_volume_by_stage_8w",
  title: "Order volume by stage — 8-week trend",
  run_date: "2026-09-04",
  computed_at: "2026-09-04T09:00:14.000Z",
  week_column: "week_start",
  series_column: "stage",
  value_column: "order_count",
  series: ["INGEST", "SCHEDULE"],
  weeks: [
    { week: "2026-07-13", values: { INGEST: 12, SCHEDULE: 30 } },
    { week: "2026-07-20", values: { SCHEDULE: 41 } },
  ],
};

describe("ReportWeekSchema", () => {
  it("accepts a week bucket with numeric series values", () => {
    expect(ReportWeekSchema.parse({ week: "2026-07-13", values: { A: 1 } }).values.A).toBe(1);
  });

  it("rejects a non-numeric series value", () => {
    expect(ReportWeekSchema.safeParse({ week: "2026-07-13", values: { A: "1" } }).success).toBe(false);
  });

  it("rejects an empty week string", () => {
    expect(ReportWeekSchema.safeParse({ week: "", values: {} }).success).toBe(false);
  });
});

describe("ReportSchema", () => {
  it("accepts a well-formed report", () => {
    expect(ReportSchema.parse(validReport)).toEqual(validReport);
  });

  it("accepts a report with no weeks yet", () => {
    expect(ReportSchema.parse({ ...validReport, series: [], weeks: [] }).weeks).toEqual([]);
  });

  it("rejects a report missing a column-name field", () => {
    const withoutWeekColumn: Record<string, unknown> = { ...validReport };
    delete withoutWeekColumn.week_column;
    expect(ReportSchema.safeParse(withoutWeekColumn).success).toBe(false);
  });
});

describe("ReportsResponseSchema", () => {
  it("wraps an array of reports", () => {
    expect(ReportsResponseSchema.parse({ reports: [validReport] }).reports).toHaveLength(1);
  });

  it("accepts an empty reports array", () => {
    expect(ReportsResponseSchema.parse({ reports: [] }).reports).toEqual([]);
  });
});
