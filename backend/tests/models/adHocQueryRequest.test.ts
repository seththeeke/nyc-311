import { describe, expect, it } from "vitest";
import { AdHocQueryRequestSchema } from "../../models/adHocQueryRequest";

describe("AdHocQueryRequestSchema", () => {
  it("accepts a well-formed request", () => {
    expect(AdHocQueryRequestSchema.parse({ sql: "SELECT 1" })).toEqual({ sql: "SELECT 1" });
  });

  it("rejects an empty sql string", () => {
    expect(AdHocQueryRequestSchema.safeParse({ sql: "" }).success).toBe(false);
  });

  it("rejects a missing sql field", () => {
    expect(AdHocQueryRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string sql field", () => {
    expect(AdHocQueryRequestSchema.safeParse({ sql: 123 }).success).toBe(false);
  });
});
