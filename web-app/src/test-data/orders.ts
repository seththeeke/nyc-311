import type { Order } from "../models/order";

/*
 * Baked sample data for "mock" data mode (config.ts) — a small, lightweight
 * fixture set, not a snapshot of real production data. Mixes current_stage
 * values so the Orders list view's stage filter has something to actually
 * filter, even though every Order created by the real pipeline today starts
 * (and stays) at INGEST/CREATED — 4-order-workflow.md's state machine is
 * what will eventually advance a real Order past that.
 */
export const MOCK_ORDERS: Order[] = Array.from({ length: 34 }, (_, i) => {
  const stage = (["INGEST", "SCHEDULE", "EXECUTE", "RESOLVE"] as const)[i % 4];
  const createdAt = new Date(Date.UTC(2026, 7, 21, 0, 0, 0) - i * 45 * 60_000).toISOString();
  return {
    order_id: `01MOCKORDER${String(i).padStart(3, "0")}`,
    request_id: `01MOCKREQUEST${String(i).padStart(3, "0")}`,
    location_id: `MOCKLOC${String(i % 7).padStart(3, "0")}`,
    current_stage: stage,
    status: "CREATED",
    retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
    priority_tier: null,
    sla_deadline: null,
    scheduled_start: null,
    scheduled_end: null,
    assigned_operator_id: null,
    reassignment_count: 0,
    case_id: null,
    created_at: createdAt,
    updated_at: createdAt,
    last_event_sequence: 0,
  };
});
