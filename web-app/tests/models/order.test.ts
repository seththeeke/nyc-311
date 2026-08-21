import { describe, expect, it } from "vitest";
import { OrderListResponseSchema, OrderSchema, ORDER_STAGES } from "../../src/models/order";

const validOrder = {
  order_id: "01ORDER",
  request_id: "01REQUEST",
  location_id: "1234567890",
  current_stage: "INGEST",
  status: "CREATED",
  retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
  priority_tier: null,
  sla_deadline: null,
  scheduled_start: null,
  scheduled_end: null,
  assigned_operator_id: null,
  reassignment_count: 0,
  case_id: null,
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
  last_event_sequence: 0,
};

describe("OrderSchema", () => {
  it("accepts a well-formed Order", () => {
    expect(OrderSchema.parse(validOrder)).toEqual(validOrder);
  });

  it("accepts every locked current_stage value", () => {
    for (const stage of ORDER_STAGES) {
      expect(OrderSchema.safeParse({ ...validOrder, current_stage: stage }).success).toBe(true);
    }
  });

  it("rejects an unrecognized status", () => {
    expect(OrderSchema.safeParse({ ...validOrder, status: "IN_PROGRESS" }).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const withoutLocation: Record<string, unknown> = { ...validOrder };
    delete withoutLocation.location_id;
    expect(OrderSchema.safeParse(withoutLocation).success).toBe(false);
  });
});

describe("OrderListResponseSchema", () => {
  it("accepts a well-formed response envelope with a null cursor", () => {
    const response = { orders: [validOrder], nextCursor: null };
    expect(OrderListResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts a well-formed response envelope with a cursor string", () => {
    const response = { orders: [], nextCursor: "opaque-cursor" };
    expect(OrderListResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects a response missing nextCursor", () => {
    expect(OrderListResponseSchema.safeParse({ orders: [] }).success).toBe(false);
  });
});
