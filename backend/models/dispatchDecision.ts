import { z } from "zod";

/*
 * Dispatch decision stamps and records (20-ml-driver-assignment.md §2.4).
 * Every dispatch carries the policy that made it, so every metric can be
 * split by policy; one record per committed decision lands in the
 * dispatch_decisions warehouse table.
 */

/* DISPATCH_POLICY's treatments (§3.1): C = hourly batch, T1 = immediate, T2 = immediate + planner. */
export const DISPATCH_POLICIES = ["C", "T1", "T2"] as const;
export type DispatchPolicy = (typeof DISPATCH_POLICIES)[number];

export const DISPATCH_POLICY_FLAG_KEY = "DISPATCH_POLICY";

/* What started the scheduling pass. Only SCHEDULE exists until Leg 1b adds the event triggers. */
export const DISPATCH_TRIGGERS = ["SCHEDULE", "ORDER_ACCEPTED", "WORK_COMPLETED", "WORK_ABORTED", "OPERATOR_ADDED", "HOLD_EXPIRED"] as const;
export type DispatchTrigger = (typeof DISPATCH_TRIGGERS)[number];

export const DISPATCH_DECISION_TYPES = ["ASSIGN", "HOLD"] as const;
export type DispatchDecisionType = (typeof DISPATCH_DECISION_TYPES)[number];

/* Stamped onto ORDER_SCHEDULED's and TRANSIT_STARTED's payloads. */
export const DispatchStampSchema = z.object({
  dispatch_policy: z.enum(DISPATCH_POLICIES),
  planner_run_id: z.string().min(1),
  trigger: z.enum(DISPATCH_TRIGGERS),
  model_version: z.string().min(1).nullable(),
});
export type DispatchStamp = z.infer<typeof DispatchStampSchema>;

/**
 * One dispatch_decisions row. Flat on purpose: `considered_order_ids` is
 * a JSON array serialized to a string, so the warehouse transform needs
 * no new opaque field. Hold fields stay null until T2 (Leg 5).
 */
export const DispatchDecisionSchema = z.object({
  planner_run_id: z.string().min(1),
  decided_at: z.string().min(1),
  dispatch_policy: z.enum(DISPATCH_POLICIES),
  trigger: z.enum(DISPATCH_TRIGGERS),
  model_version: z.string().min(1).nullable(),
  decision_type: z.enum(DISPATCH_DECISION_TYPES),
  operator_id: z.string().min(1),
  order_id: z.string().min(1),
  considered_order_ids: z.string(),
  considered_count: z.number().int().nonnegative(),
  order_age_rank: z.number().int().positive(),
  location_is_fallback: z.boolean(),
  distance_miles: z.number().nonnegative(),
  predicted_transit_minutes: z.number().nonnegative(),
  predicted_work_minutes: z.number().nonnegative(),
  edge_cost: z.number().nullable(),
  wait_for_operator_id: z.string().min(1).nullable(),
  expected_free_at: z.string().min(1).nullable(),
  predicted_saving_minutes: z.number().nullable(),
  recheck_at: z.string().min(1).nullable(),
});
export type DispatchDecision = z.infer<typeof DispatchDecisionSchema>;
