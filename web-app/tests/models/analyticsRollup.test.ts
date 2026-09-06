import { describe, expect, it } from "vitest";
import { AnalyticsRollupSchema, AnalyticsRollupListResponseSchema } from "../../src/models/analyticsRollup";

const validRollup = {
  metric_view: "ORDER_VOLUME_BY_STAGE",
  rollup_key: "2026-09-04#SCHEDULE",
  run_date: "2026-09-04",
  dimension: "SCHEDULE",
  value: 412,
  computed_at: "2026-09-04T09:00:14.000Z",
  job_run_id: "01J8Z2SUCCEEDED000000000002",
};

describe("AnalyticsRollupSchema", () => {
  it("accepts a well-formed rollup row", () => {
    expect(AnalyticsRollupSchema.parse(validRollup)).toEqual(validRollup);
  });

  it("accepts a zero value", () => {
    expect(AnalyticsRollupSchema.parse({ ...validRollup, value: 0 }).value).toBe(0);
  });

  it("rejects an empty metric_view", () => {
    expect(AnalyticsRollupSchema.safeParse({ ...validRollup, metric_view: "" }).success).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    expect(AnalyticsRollupSchema.safeParse({ ...validRollup, value: "412" }).success).toBe(false);
  });
});

describe("AnalyticsRollupListResponseSchema", () => {
  it("accepts a list of rollups", () => {
    const response = { rollups: [validRollup] };
    expect(AnalyticsRollupListResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty list", () => {
    expect(AnalyticsRollupListResponseSchema.parse({ rollups: [] })).toEqual({ rollups: [] });
  });

  it("rejects a response missing rollups", () => {
    expect(AnalyticsRollupListResponseSchema.safeParse({}).success).toBe(false);
  });
});
