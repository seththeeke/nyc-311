import { z } from "zod";

/*
 * Mirrors data-model.md#operator, simplified for v1 per
 * 10-capacity-modeling-and-integration.md §1.1 — no pools/shifts yet, so
 * `function_type`/`current_shift_id` are dropped (re-added when those get
 * built for real). Event-sourced, same source-of-truth/projection split
 * as Order. Enum values ALL_CAPS per CLAUDE.md §6.
 */

export const OPERATOR_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

export const OPERATOR_ACTIVITIES = ["IDLE", "TRANSIT", "WORKING"] as const;
export type OperatorActivity = (typeof OPERATOR_ACTIVITIES)[number];

export const OPERATOR_EVENT_TYPES = [
  "OPERATOR_ADDED",
  "OPERATOR_REMOVAL_REQUESTED",
  "OPERATOR_REMOVED",
  "TRANSIT_STARTED",
  "WORK_STARTED",
  "WORK_COMPLETED",
] as const;
export type OperatorEventType = (typeof OPERATOR_EVENT_TYPES)[number];

export const OPERATOR_ACTORS = ["SYSTEM", "AGENT", "ADMIN"] as const;
export type OperatorActor = (typeof OPERATOR_ACTORS)[number];

export const OperatorEventSchema = z.object({
  operator_id: z.string().min(1),
  sequence_number: z.number().int().nonnegative(),
  event_type: z.enum(OPERATOR_EVENT_TYPES),
  payload: z.record(z.string(), z.unknown()),
  occurred_at: z.string().min(1),
  actor: z.enum(OPERATOR_ACTORS),
});
export type OperatorEvent = z.infer<typeof OperatorEventSchema>;

export const OperatorSchema = z.object({
  operator_id: z.string().min(1),
  status: z.enum(OPERATOR_STATUSES),
  current_activity: z.enum(OPERATOR_ACTIVITIES),
  /*
   * Set when an admin removes a *busy* operator — current_activity stays
   * whatever it was; the operator simply isn't reassigned again and gets
   * finalized (-> INACTIVE, end_datetime stamped) once its current
   * execution resolves. Removing an already-IDLE operator finalizes
   * immediately instead of setting this field.
   */
  removal_requested_at: z.string().min(1).nullable(),
  start_datetime: z.string().min(1),
  /* A retired operator_id is never reactivated — adding capacity later always creates a new Operator. */
  end_datetime: z.string().min(1).nullable(),
  /* Stamped at OPERATOR_ADDED, immutable — historical cost stays stable even if the default rate changes later. */
  rate_per_hour: z.number().positive(),
  last_event_sequence: z.number().int().nonnegative(),
});
export type Operator = z.infer<typeof OperatorSchema>;
