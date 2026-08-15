import { describe, expect, it } from "vitest";
import { POLLER_METRICS_GSI_PK, PollerMetricsSchema } from "../../models/pollerMetrics";

const validMetrics = {
  ran_at: "2026-08-15T00:00:00.000Z",
  success: true,
  records_ingested: 12,
  duplicates_skipped: 3,
  records_rejected: 1,
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

  it("strips unrecognized keys (e.g. storage-layer GSI attributes)", () => {
    const withExtras = { ...validMetrics, request_id: "METRIC#01ABC", gsi4pk: "POLLER#METRICS" };
    expect(PollerMetricsSchema.parse(withExtras)).toEqual(validMetrics);
  });

  it.each([
    ["ran_at", ""],
    ["records_ingested", -1],
    ["records_ingested", 1.5],
    ["error_message", ""],
  ])("rejects an invalid %s value", (field, value) => {
    expect(PollerMetricsSchema.safeParse({ ...validMetrics, [field]: value }).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const withoutSuccess: Record<string, unknown> = { ...validMetrics };
    delete withoutSuccess.success;
    expect(PollerMetricsSchema.safeParse(withoutSuccess).success).toBe(false);
  });
});

describe("POLLER_METRICS_GSI_PK", () => {
  it("is the fixed sentinel value every poller-metrics item shares", () => {
    expect(POLLER_METRICS_GSI_PK).toBe("POLLER#METRICS");
  });
});
