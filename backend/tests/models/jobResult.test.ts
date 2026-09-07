import { describe, expect, it } from "vitest";
import { JobResultSchema } from "../../models/jobResult";

const valid = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01RUN",
  run_date: "2026-09-07",
  computed_at: "2026-09-07T14:16:36.410Z",
  columns: [
    { name: "created_date", type: "varchar" },
    { name: "stage", type: "varchar" },
    { name: "order_count", type: "bigint" },
  ],
  rows: [
    { created_date: "2026-09-01", stage: "SCHEDULE", order_count: "8830" },
    { created_date: "2026-09-01", stage: "INGEST", order_count: "4918" },
  ],
};

describe("JobResultSchema", () => {
  it("accepts a well-formed envelope", () => {
    expect(JobResultSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an empty resultset", () => {
    expect(JobResultSchema.parse({ ...valid, columns: [], rows: [] }).rows).toEqual([]);
  });

  it("rejects non-string row values (Athena hands everything back as a string)", () => {
    const bad = { ...valid, rows: [{ created_date: "2026-09-01", stage: "SCHEDULE", order_count: 8830 }] };
    expect(JobResultSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a column missing name or type", () => {
    expect(JobResultSchema.safeParse({ ...valid, columns: [{ name: "x" }] }).success).toBe(false);
  });
});
