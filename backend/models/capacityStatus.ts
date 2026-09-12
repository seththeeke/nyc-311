import { z } from "zod";
import { OperatorSchema } from "./operator";

/**
 * `GET /capacity`'s response shape (`10-capacity-modeling-and-integration.md`
 * §2.1/§2.3) — live fleet stats computed from a direct query against
 * current Operator projections only (bounded by fleet size, not full
 * event history), not the all-time accumulated cost (that's a separate,
 * future warehouse-job computation — §2.3).
 */
export const CapacityStatusSchema = z.object({
  available_count: z.number().int().nonnegative(),
  fleet_size: z.number().int().nonnegative(),
  hourly_burn_rate: z.number().nonnegative(),
  roster: z.array(OperatorSchema),
});
export type CapacityStatus = z.infer<typeof CapacityStatusSchema>;
