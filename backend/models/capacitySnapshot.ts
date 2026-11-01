import { z } from "zod";
import { OperatorSchema } from "./operator";

/*
 * The COO's daily change caps (docs/17-executive-team.md §12.3): at most
 * two recruits and two releases a New York day. No fleet minimum or maximum.
 */
export const CapacityLimitsSchema = z.object({
  max_recruits_per_day: z.number().int().nonnegative(),
  max_releases_per_day: z.number().int().nonnegative(),
  recruits_today: z.number().int().nonnegative(),
  releases_today: z.number().int().nonnegative(),
  /* The New York calendar date the counts are for. */
  day: z.string(),
  day_resets_at: z.string(),
});
export type CapacityLimits = z.infer<typeof CapacityLimitsSchema>;

const DaySchema = z.object({
  day: z.string(),
  accepted_count: z.number().int().nonnegative(),
  resolved_count: z.number().int().nonnegative(),
  median_days_to_resolve: z.number().nonnegative().nullable(),
});

/** The data behind a capacity decision (§12.3): no recommendation, only facts. */
export const CapacitySnapshotSchema = z.object({
  computed_at: z.string(),
  target_median_days: z.object({ min: z.number(), max: z.number() }),
  fleet: z.object({
    size: z.number().int().nonnegative(),
    idle: z.number().int().nonnegative(),
    busy: z.number().int().nonnegative(),
    roster: z.array(OperatorSchema),
  }),
  median_days_to_resolve_7d: z.number().nonnegative().nullable(),
  days: z.array(DaySchema),
  backlog: z.object({
    waiting_to_schedule: z.number().int().nonnegative(),
    oldest_waiting_since: z.string().nullable(),
  }),
  hourly_burn_rate: z.number().nonnegative(),
  limits: CapacityLimitsSchema,
});
export type CapacitySnapshot = z.infer<typeof CapacitySnapshotSchema>;
