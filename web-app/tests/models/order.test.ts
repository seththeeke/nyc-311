import { describe, expect, it } from "vitest";
import {
  OrderEventListResponseSchema,
  OrderEventSchema,
  OrderListResponseSchema,
  OrderSchema,
  ORDER_EVENT_TYPES,
  ORDER_STAGES,
  ORDER_STATUSES,
} from "../../src/models/order";

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

  it("accepts every locked status value", () => {
    for (const status of ORDER_STATUSES) {
      expect(OrderSchema.safeParse({ ...validOrder, status }).success).toBe(true);
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

const validOrderEvent = {
  order_id: "01ORDER",
  sequence_number: 0,
  event_type: "ORDER_CREATED",
  stage: null,
  payload: {},
  occurred_at: "2026-08-26T00:00:00.000Z",
  actor: "SYSTEM",
};

describe("OrderEventSchema", () => {
  it("accepts a well-formed OrderEvent", () => {
    expect(OrderEventSchema.parse(validOrderEvent)).toEqual(validOrderEvent);
  });

  it("accepts every locked event_type value", () => {
    for (const eventType of ORDER_EVENT_TYPES) {
      expect(OrderEventSchema.safeParse({ ...validOrderEvent, event_type: eventType }).success).toBe(true);
    }
  });

  it("rejects an unrecognized event_type", () => {
    expect(OrderEventSchema.safeParse({ ...validOrderEvent, event_type: "MADE_UP" }).success).toBe(false);
  });

  it("accepts a non-null stage", () => {
    expect(OrderEventSchema.safeParse({ ...validOrderEvent, stage: "INGEST" }).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const withoutOccurredAt: Record<string, unknown> = { ...validOrderEvent };
    delete withoutOccurredAt.occurred_at;
    expect(OrderEventSchema.safeParse(withoutOccurredAt).success).toBe(false);
  });
});

describe("OrderEventListResponseSchema", () => {
  it("accepts a well-formed response envelope with a null cursor", () => {
    const response = { events: [validOrderEvent], nextCursor: null };
    expect(OrderEventListResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts a well-formed response envelope with a cursor string", () => {
    const response = { events: [], nextCursor: "opaque-cursor" };
    expect(OrderEventListResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects a response missing nextCursor", () => {
    expect(OrderEventListResponseSchema.safeParse({ events: [] }).success).toBe(false);
  });
});
