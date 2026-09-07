import { describe, expect, it } from "vitest";
import { JobResultSchema, JobResultColumnSchema } from "../../src/models/jobResult";

const valid = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01RUN",
  run_date: "2026-09-07",
  computed_at: "2026-09-07T14:16:36.410Z",
  columns: [
    { name: "created_date", type: "varchar" },
    { name: "order_count", type: "bigint" },
  ],
  rows: [{ created_date: "2026-09-01", order_count: "8830" }],
};

describe("JobResultColumnSchema", () => {
  it("requires both name and type", () => {
    expect(JobResultColumnSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(JobResultColumnSchema.parse({ name: "x", type: "varchar" })).toEqual({ name: "x", type: "varchar" });
  });
});

describe("JobResultSchema", () => {
  it("accepts a well-formed envelope", () => {
    expect(JobResultSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an empty resultset", () => {
    expect(JobResultSchema.parse({ ...valid, columns: [], rows: [] }).rows).toEqual([]);
  });

  it("rejects non-string row values (Athena returns strings)", () => {
    expect(JobResultSchema.safeParse({ ...valid, rows: [{ order_count: 8830 }] }).success).toBe(false);
  });

  it("rejects a missing top-level field", () => {
    const rest = { ...valid } as Partial<typeof valid>;
    delete rest.run_date;
    expect(JobResultSchema.safeParse(rest).success).toBe(false);
  });
});
