import { describe, expect, it } from "vitest";
import { AnalyticsRollupListResponseSchema, AnalyticsRollupSchema } from "../../models/analyticsRollup";

const valid = {
  metric_view: "ORDER_VOLUME_BY_STAGE",
  rollup_key: "2026-09-06#SCHEDULE",
  run_date: "2026-09-06",
  dimension: "SCHEDULE",
  value: 42,
  computed_at: "2026-09-06T09:00:12.000Z",
  job_run_id: "01RUN",
};

describe("AnalyticsRollupSchema", () => {
  it("accepts a well-formed rollup row", () => {
    expect(AnalyticsRollupSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a zero value", () => {
    expect(AnalyticsRollupSchema.parse({ ...valid, value: 0 }).value).toBe(0);
  });

  it("rejects a non-numeric value or missing metric_view", () => {
    expect(AnalyticsRollupSchema.safeParse({ ...valid, value: "42" }).success).toBe(false);
    const { metric_view, ...rest } = valid;
    void metric_view;
    expect(AnalyticsRollupSchema.safeParse(rest).success).toBe(false);
  });
});

describe("AnalyticsRollupListResponseSchema", () => {
  it("accepts an empty list", () => {
    expect(AnalyticsRollupListResponseSchema.parse({ rollups: [] })).toEqual({ rollups: [] });
  });
});
