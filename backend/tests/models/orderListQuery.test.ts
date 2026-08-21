import { describe, expect, it } from "vitest";
import { DEFAULT_ORDER_PAGE_SIZE, MAX_ORDER_PAGE_SIZE, OrderListQuerySchema } from "../../models/orderListQuery";

describe("OrderListQuerySchema", () => {
  it("accepts an empty query (every field optional)", () => {
    expect(OrderListQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces a numeric-string limit to a number", () => {
    const parsed = OrderListQuerySchema.parse({ limit: "5" });
    expect(parsed.limit).toBe(5);
  });

  it.each([["0"], ["-1"], ["1.5"], [String(MAX_ORDER_PAGE_SIZE + 1)]])(
    "rejects an out-of-range limit %s",
    (limit) => {
      expect(OrderListQuerySchema.safeParse({ limit }).success).toBe(false);
    }
  );

  it("accepts the maximum page size", () => {
    expect(OrderListQuerySchema.safeParse({ limit: String(MAX_ORDER_PAGE_SIZE) }).success).toBe(true);
  });

  it("accepts a cursor string", () => {
    expect(OrderListQuerySchema.safeParse({ cursor: "opaque-cursor" }).success).toBe(true);
  });

  it("rejects an empty-string cursor", () => {
    expect(OrderListQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
  });

  it("accepts every locked stage value", () => {
    for (const stage of ["INGEST", "SCHEDULE", "EXECUTE", "RESOLVE"]) {
      expect(OrderListQuerySchema.safeParse({ stage }).success).toBe(true);
    }
  });

  it("rejects an unrecognized stage", () => {
    expect(OrderListQuerySchema.safeParse({ stage: "MADE_UP" }).success).toBe(false);
  });

  it("accepts the locked status value", () => {
    expect(OrderListQuerySchema.safeParse({ status: "CREATED" }).success).toBe(true);
  });

  it("rejects an unrecognized status", () => {
    expect(OrderListQuerySchema.safeParse({ status: "IN_PROGRESS" }).success).toBe(false);
  });
});

describe("DEFAULT_ORDER_PAGE_SIZE", () => {
  it("is a positive default within the allowed range", () => {
    expect(DEFAULT_ORDER_PAGE_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_ORDER_PAGE_SIZE).toBeLessThanOrEqual(MAX_ORDER_PAGE_SIZE);
  });
});
