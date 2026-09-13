import { z } from "zod";

/*
 * The EventBridge Scheduler target's Input for the warehouse job runner
 * (`7-data-warehousing.md` §8, Leg 8) — `{"job_name": "<name>"}`, since
 * each job has its own schedule now and one invocation runs exactly one
 * job. Still validated, not just cast, per CLAUDE.md §5.2.
 */
export const WarehouseJobTriggerSchema = z.object({
  job_name: z.string().min(1),
});
export type WarehouseJobTrigger = z.infer<typeof WarehouseJobTriggerSchema>;
