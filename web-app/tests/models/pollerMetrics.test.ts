import { describe, expect, it } from "vitest";
import { PollerMetricsResponseSchema, PollerMetricsSchema } from "../../src/models/pollerMetrics";

const validMetrics = {
  ran_at: "2026-08-15T15:12:43.894Z",
  success: true,
  records_ingested: 2000,
  duplicates_skipped: 0,
  records_rejected: 0,
  error_message: null,
};

describe("PollerMetricsSchema", () => {
  it("accepts a well-formed successful-run record", () => {
    expect(PollerMetricsSchema.parse(validMetrics)).toEqual(validMetrics);
  });

  it("accepts a well-formed failed-run record with an error message", () => {
    const failed = { ...validMetrics, success: false, error_message: "SODA API down" };
    expect(PollerMetricsSchema.parse(failed)).toEqual(failed);
  });

  it("rejects a negative count", () => {
    expect(PollerMetricsSchema.safeParse({ ...validMetrics, records_ingested: -1 }).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const withoutSuccess: Record<string, unknown> = { ...validMetrics };
    delete withoutSuccess.success;
    expect(PollerMetricsSchema.safeParse(withoutSuccess).success).toBe(false);
  });
});

describe("PollerMetricsResponseSchema", () => {
  it("accepts a well-formed response envelope", () => {
    const response = { metrics: [validMetrics] };
    expect(PollerMetricsResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty metrics array", () => {
    expect(PollerMetricsResponseSchema.parse({ metrics: [] })).toEqual({ metrics: [] });
  });

  it("rejects a response missing the metrics array", () => {
    expect(PollerMetricsResponseSchema.safeParse({}).success).toBe(false);
  });
});
