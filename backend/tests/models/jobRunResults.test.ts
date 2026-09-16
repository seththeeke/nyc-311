import { describe, expect, it } from "vitest";
import { JobRunResultItemSchema, JobRunResultsResponseSchema } from "../../models/jobRunResults";

const validResult = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01RUN",
  run_date: "2026-09-07",
  computed_at: "2026-09-07T14:16:36.410Z",
  columns: [{ name: "stage", type: "varchar" }],
  rows: [{ stage: "SCHEDULE" }],
};

describe("JobRunResultItemSchema", () => {
  it("accepts an item with a result and no error", () => {
    const item = { job_run_id: "01RUN", result: validResult, error: null };
    expect(JobRunResultItemSchema.parse(item)).toEqual(item);
  });

  it("accepts an item with an error and no result", () => {
    const item = { job_run_id: "01GHOST", result: null, error: "No result for this job run" };
    expect(JobRunResultItemSchema.parse(item)).toEqual(item);
  });

  it("rejects an item missing job_run_id", () => {
    expect(JobRunResultItemSchema.safeParse({ result: null, error: null }).success).toBe(false);
  });

  it("rejects a result that fails JobResultSchema validation", () => {
    const item = { job_run_id: "01RUN", result: { not: "an envelope" }, error: null };
    expect(JobRunResultItemSchema.safeParse(item).success).toBe(false);
  });
});

describe("JobRunResultsResponseSchema", () => {
  it("accepts an empty results array", () => {
    expect(JobRunResultsResponseSchema.parse({ results: [] })).toEqual({ results: [] });
  });

  it("accepts a mix of succeeded and errored items", () => {
    const body = {
      results: [
        { job_run_id: "01A", result: validResult, error: null },
        { job_run_id: "01B", result: null, error: "No result for this job run" },
      ],
    };
    expect(JobRunResultsResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects a response missing results", () => {
    expect(JobRunResultsResponseSchema.safeParse({}).success).toBe(false);
  });
});
