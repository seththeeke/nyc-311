import { z } from "zod";

/*
 * Mirrors backend/models/operator.ts's Operator — simplified for v1 per
 * 10-capacity-modeling-and-integration.md §1.1 (no pools/shifts yet).
 * Every service response is parsed through this schema before it reaches
 * a component (CLAUDE.md §5.1's runtime-validation-at-the-network-
 * boundary rule).
 */

export const OPERATOR_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

export const OPERATOR_ACTIVITIES = ["IDLE", "TRANSIT", "WORKING"] as const;
export type OperatorActivity = (typeof OPERATOR_ACTIVITIES)[number];

export const OperatorSchema = z.object({
  operator_id: z.string().min(1),
  /** Free-text, admin-supplied, not unique — the only way to identify an Operator past its id. */
  name: z.string().min(1),
  status: z.enum(OPERATOR_STATUSES),
  current_activity: z.enum(OPERATOR_ACTIVITIES),
  removal_requested_at: z.string().min(1).nullable(),
  start_datetime: z.string().min(1),
  end_datetime: z.string().min(1).nullable(),
  rate_per_hour: z.number().positive(),
  last_event_sequence: z.number().int().nonnegative(),
});
export type Operator = z.infer<typeof OperatorSchema>;

export const CapacityStatusSchema = z.object({
  available_count: z.number().int().nonnegative(),
  fleet_size: z.number().int().nonnegative(),
  hourly_burn_rate: z.number().nonnegative(),
  roster: z.array(OperatorSchema),
});
export type CapacityStatus = z.infer<typeof CapacityStatusSchema>;
