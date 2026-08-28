import { z } from "zod";

/*
 * The EventBridge Scheduler target's configured Input for the order-
 * scheduling job (6-order-scheduling.md §1) — empty by design, same shape
 * as models/ingestionPollTrigger.ts: every run derives its own work from
 * gsi1-stage-sla rather than taking per-invocation parameters. Still
 * validated, not just cast, per CLAUDE.md §5.2.
 */

export const OrderSchedulingTriggerSchema = z.record(z.string(), z.unknown());

export type OrderSchedulingTrigger = z.infer<typeof OrderSchedulingTriggerSchema>;
