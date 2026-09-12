import type { Operator } from "../models/operator";

/*
 * Baked sample data for "mock" data mode (config.ts) — mirrors the 10
 * vehicles test-scripts/7-seed-capacity.py seeds into a real environment,
 * all at the same default rate (10-capacity-modeling-and-integration.md
 * §1.2/§1.3).
 */
export const MOCK_OPERATORS: Operator[] = Array.from({ length: 10 }, (_, i) => ({
  operator_id: `01MOCKOPERATOR${String(i).padStart(3, "0")}`,
  status: "ACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: new Date(Date.UTC(2026, 8, 1, 0, 0, 0) + i * 3_600_000).toISOString(),
  end_datetime: null,
  rate_per_hour: 45,
  last_event_sequence: 0,
}));
