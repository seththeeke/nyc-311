import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER_EVENT_PAGE_SIZE,
  MAX_ORDER_EVENT_PAGE_SIZE,
  OrderEventListQuerySchema,
} from "../../models/orderEventListQuery";

describe("OrderEventListQuerySchema", () => {
  it("accepts an empty query (every field optional)", () => {
    expect(OrderEventListQuerySchema.safeParse({}).success).toBe(true);
  });

  it("coerces a numeric-string limit to a number", () => {
    const parsed = OrderEventListQuerySchema.parse({ limit: "5" });
    expect(parsed.limit).toBe(5);
  });

  it.each([["0"], ["-1"], ["1.5"], [String(MAX_ORDER_EVENT_PAGE_SIZE + 1)]])(
    "rejects an out-of-range limit %s",
    (limit) => {
      expect(OrderEventListQuerySchema.safeParse({ limit }).success).toBe(false);
    }
  );

  it("accepts the maximum page size", () => {
    expect(OrderEventListQuerySchema.safeParse({ limit: String(MAX_ORDER_EVENT_PAGE_SIZE) }).success).toBe(true);
  });

  it("accepts a cursor string", () => {
    expect(OrderEventListQuerySchema.safeParse({ cursor: "opaque-cursor" }).success).toBe(true);
  });

  it("rejects an empty-string cursor", () => {
    expect(OrderEventListQuerySchema.safeParse({ cursor: "" }).success).toBe(false);
  });

  it("accepts an order_id filter", () => {
    expect(OrderEventListQuerySchema.safeParse({ order_id: "01ORDER" }).success).toBe(true);
  });

  it("rejects an empty-string order_id", () => {
    expect(OrderEventListQuerySchema.safeParse({ order_id: "" }).success).toBe(false);
  });

  it("accepts every locked event_type value", () => {
    for (const eventType of ["ORDER_CREATED", "ORDER_ACCEPTED", "ORDER_REJECTED", "CASE_CREATED"]) {
      expect(OrderEventListQuerySchema.safeParse({ event_type: eventType }).success).toBe(true);
    }
  });

  it("rejects an unrecognized event_type", () => {
    expect(OrderEventListQuerySchema.safeParse({ event_type: "MADE_UP" }).success).toBe(false);
  });
});

describe("DEFAULT_ORDER_EVENT_PAGE_SIZE", () => {
  it("is a positive default within the allowed range", () => {
    expect(DEFAULT_ORDER_EVENT_PAGE_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_ORDER_EVENT_PAGE_SIZE).toBeLessThanOrEqual(MAX_ORDER_EVENT_PAGE_SIZE);
  });
});
