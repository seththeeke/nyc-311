import { z } from "zod";

/*
 * 10-capacity-modeling-and-integration.md §2.1's request shapes for the
 * admin-only capacity CRUD routes. One model file per shared-but-not-a-
 * domain-entity type, per CLAUDE.md §5.2.
 */

export const AddCapacityRequestSchema = z.object({
  /** Free-text, not unique — the only way to identify this Operator past its id. */
  name: z.string().min(1),
  /** Omitted -> service defaults to DEFAULT_OPERATOR_RATE_PER_HOUR (§1.2). */
  rate_per_hour: z.number().positive().optional(),
});
export type AddCapacityRequest = z.infer<typeof AddCapacityRequestSchema>;

export const RemoveCapacityParamsSchema = z.object({
  operator_id: z.string().min(1),
});
export type RemoveCapacityParams = z.infer<typeof RemoveCapacityParamsSchema>;
