import { z } from "zod";

export const healthSeveritySchema = z.enum(["ERROR", "WARN"]);
export type HealthSeverity = z.infer<typeof healthSeveritySchema>;

/** One problem found with an agent's setup or recent runs (SPEC.md §3.2). */
export const healthFindingSchema = z.object({
  severity: healthSeveritySchema,
  code: z.string(),
  message: z.string(),
});
export type HealthFinding = z.infer<typeof healthFindingSchema>;
