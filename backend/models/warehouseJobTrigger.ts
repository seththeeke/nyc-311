import { z } from "zod";

/*
 * The EventBridge Scheduler target's Input for the daily warehouse job
 * runner (`7-data-warehousing.md` §8) — empty by design, same shape as
 * models/orderSchedulingTrigger.ts. Still validated, not just cast, per
 * CLAUDE.md §5.2.
 */
export const WarehouseJobTriggerSchema = z.record(z.string(), z.unknown());
export type WarehouseJobTrigger = z.infer<typeof WarehouseJobTriggerSchema>;
