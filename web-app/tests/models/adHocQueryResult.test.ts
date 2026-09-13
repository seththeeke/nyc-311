import { describe, expect, it } from "vitest";
import { AdHocQueryResultSchema } from "../../src/models/adHocQueryResult";

const valid = {
  columns: [{ name: "borough", type: "varchar" }],
  rows: [{ borough: "BROOKLYN" }],
  row_count: 1,
  truncated: false,
  data_scanned_bytes: 1024,
  engine_execution_time_ms: 250,
};

describe("AdHocQueryResultSchema", () => {
  it("accepts a well-formed envelope", () => {
    expect(AdHocQueryResultSchema.parse(valid)).toEqual(valid);
  });

  it("accepts null stats", () => {
    const withNullStats = { ...valid, data_scanned_bytes: null, engine_execution_time_ms: null };
    expect(AdHocQueryResultSchema.parse(withNullStats)).toEqual(withNullStats);
  });

  it("rejects non-string row values", () => {
    expect(AdHocQueryResultSchema.safeParse({ ...valid, rows: [{ borough: 5 }] }).success).toBe(false);
  });

  it("rejects a column missing name or type", () => {
    expect(AdHocQueryResultSchema.safeParse({ ...valid, columns: [{ name: "x" }] }).success).toBe(false);
  });
});
