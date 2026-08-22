import { describe, expect, it } from "vitest";
import {
  IngestionCursorStatusSchema,
  PollerMetricsResponseSchema,
  PollerMetricsSchema,
} from "../../src/models/pollerMetrics";

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

const validCursor = {
  last_watermark: "2026-08-15T18:00:00",
  resume_offset: null,
  lag_hours: 72,
  is_stale: false,
};

describe("IngestionCursorStatusSchema", () => {
  it("accepts a healthy cursor", () => {
    expect(IngestionCursorStatusSchema.parse(validCursor)).toEqual(validCursor);
  });

  it("accepts a mid-window cursor with a non-null resume_offset", () => {
    const midWindow = { ...validCursor, resume_offset: 72000, lag_hours: 288, is_stale: true };
    expect(IngestionCursorStatusSchema.parse(midWindow)).toEqual(midWindow);
  });

  it("accepts null last_watermark/resume_offset/lag_hours", () => {
    const noWatermark = { last_watermark: null, resume_offset: null, lag_hours: null, is_stale: false };
    expect(IngestionCursorStatusSchema.parse(noWatermark)).toEqual(noWatermark);
  });

  it("rejects a missing is_stale field", () => {
    const withoutIsStale: Record<string, unknown> = { ...validCursor };
    delete withoutIsStale.is_stale;
    expect(IngestionCursorStatusSchema.safeParse(withoutIsStale).success).toBe(false);
  });
});

describe("PollerMetricsResponseSchema", () => {
  it("accepts a well-formed response envelope", () => {
    const response = { metrics: [validMetrics], cursor: validCursor };
    expect(PollerMetricsResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty metrics array with a null cursor", () => {
    expect(PollerMetricsResponseSchema.parse({ metrics: [], cursor: null })).toEqual({
      metrics: [],
      cursor: null,
    });
  });

  it("rejects a response missing the metrics array", () => {
    expect(PollerMetricsResponseSchema.safeParse({ cursor: null }).success).toBe(false);
  });

  it("rejects a response missing the cursor field", () => {
    expect(PollerMetricsResponseSchema.safeParse({ metrics: [] }).success).toBe(false);
  });
});
