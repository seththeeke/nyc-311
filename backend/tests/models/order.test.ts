import { describe, expect, it } from "vitest";
import { OrderSchema, OrderEventSchema, ORDER_STAGES, ORDER_EVENT_TYPES } from "../../models/order";

function makeOrderEvent(overrides: Record<string, unknown> = {}): unknown {
  return {
    order_id: "01ORDER",
    sequence_number: 0,
    event_type: "ORDER_CREATED",
    stage: null,
    payload: { request_id: "01REQUEST" },
    occurred_at: "2026-08-20T00:00:00.000Z",
    actor: "SYSTEM",
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}): unknown {
  return {
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
    ...overrides,
  };
}

describe("OrderEventSchema", () => {
  it("accepts a well-formed ORDER_CREATED event", () => {
    expect(OrderEventSchema.safeParse(makeOrderEvent()).success).toBe(true);
  });

  it("accepts every locked event_type value", () => {
    for (const eventType of ORDER_EVENT_TYPES) {
      expect(OrderEventSchema.safeParse(makeOrderEvent({ event_type: eventType })).success).toBe(true);
    }
  });

  it("accepts every locked stage value, and null", () => {
    for (const stage of ORDER_STAGES) {
      expect(OrderEventSchema.safeParse(makeOrderEvent({ stage })).success).toBe(true);
    }
    expect(OrderEventSchema.safeParse(makeOrderEvent({ stage: null })).success).toBe(true);
  });

  it("rejects an unrecognized event_type", () => {
    expect(OrderEventSchema.safeParse(makeOrderEvent({ event_type: "MADE_UP" })).success).toBe(false);
  });

  it("rejects an unrecognized actor", () => {
    expect(OrderEventSchema.safeParse(makeOrderEvent({ actor: "ROBOT" })).success).toBe(false);
  });

  it("rejects a negative sequence_number", () => {
    expect(OrderEventSchema.safeParse(makeOrderEvent({ sequence_number: -1 })).success).toBe(false);
  });
});

describe("OrderSchema", () => {
  it("accepts a freshly-created Order projection", () => {
    expect(OrderSchema.safeParse(makeOrder()).success).toBe(true);
  });

  it("accepts every locked current_stage value", () => {
    for (const stage of ORDER_STAGES) {
      expect(OrderSchema.safeParse(makeOrder({ current_stage: stage })).success).toBe(true);
    }
  });

  it("rejects a null current_stage (unlike OrderEvent.stage, this is required)", () => {
    expect(OrderSchema.safeParse(makeOrder({ current_stage: null })).success).toBe(false);
  });

  it("rejects an unrecognized status", () => {
    expect(OrderSchema.safeParse(makeOrder({ status: "IN_PROGRESS" })).success).toBe(false);
  });

  it("accepts null for every workflow-derived field", () => {
    const order = makeOrder({
      priority_tier: null,
      sla_deadline: null,
      scheduled_start: null,
      scheduled_end: null,
      assigned_operator_id: null,
      case_id: null,
    });
    expect(OrderSchema.safeParse(order).success).toBe(true);
  });

  it("rejects a missing location_id", () => {
    const order = makeOrder() as Record<string, unknown>;
    delete order["location_id"];
    expect(OrderSchema.safeParse(order).success).toBe(false);
  });
});
