import { z } from "zod";
import { OpsClientConfigSchema } from "./opsClientConfig";

/** The most warehouse queries one Software Engineer run may send (docs/17-executive-team.md §22.9). */
export const ENGINEERING_QUERY_LIMIT_MAX = 10;

/*
 * What the boroughsim-engineering MCP server reads from its environment
 * (docs/17-executive-team.md §22.9): the ops client's sign-in, plus the
 * run's query budget, which can't be raised past the cap.
 */
export const EngineeringClientConfigSchema = OpsClientConfigSchema.extend({
  ENGINEERING_QUERY_LIMIT: z.coerce.number().int().min(0).max(ENGINEERING_QUERY_LIMIT_MAX).optional(),
});
export type EngineeringClientConfig = z.infer<typeof EngineeringClientConfigSchema>;
