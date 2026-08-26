import type { OrderEvent } from "../models/order";
import { MOCK_ORDERS } from "./orders";

/*
 * Baked sample data for "mock" data mode (config.ts) — one ORDER_CREATED
 * per mock Order, plus a matching outcome event: ORDER_ACCEPTED for
 * ACTIVE, ORDER_REJECTED for REJECTED. A CASE_CREATED is sprinkled onto
 * some still-CREATED Orders too — per 5-order-evaluation.md §4, that
 * outcome deliberately leaves `status` unchanged. Sorted newest-first,
 * matching GET /order-events' own sort shape.
 */
export const MOCK_ORDER_EVENTS: OrderEvent[] = MOCK_ORDERS.flatMap((order, i) => {
  const created: OrderEvent = {
    order_id: order.order_id,
    sequence_number: 0,
    event_type: "ORDER_CREATED",
    stage: null,
    payload: { request_id: order.request_id, location_id: order.location_id },
    occurred_at: order.created_at,
    actor: "SYSTEM",
  };

  const outcomeAt = new Date(new Date(order.created_at).getTime() + 60_000).toISOString();

  if (order.status === "ACTIVE") {
    const accepted: OrderEvent = {
      order_id: order.order_id,
      sequence_number: 1,
      event_type: "ORDER_ACCEPTED",
      stage: null,
      payload: { priority_tier: order.priority_tier, sla_deadline: order.sla_deadline },
      occurred_at: outcomeAt,
      actor: "SYSTEM",
    };
    return [created, accepted];
  }

  if (order.status === "REJECTED") {
    const rejected: OrderEvent = {
      order_id: order.order_id,
      sequence_number: 1,
      event_type: "ORDER_REJECTED",
      stage: null,
      payload: { reason: "Rejected by evaluation rule" },
      occurred_at: outcomeAt,
      actor: "SYSTEM",
    };
    return [created, rejected];
  }

  /* Still CREATED — most have no outcome event yet; a few got a CASE_CREATED, status unchanged. */
  if (i % 10 === 2) {
    const caseCreated: OrderEvent = {
      order_id: order.order_id,
      sequence_number: 1,
      event_type: "CASE_CREATED",
      stage: null,
      payload: { reason: "No applicable evaluation rule" },
      occurred_at: outcomeAt,
      actor: "SYSTEM",
    };
    return [created, caseCreated];
  }

  return [created];
}).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
