import { z } from "zod";
import { OpsClientConfigSchema } from "./opsClientConfig";

/** The most warehouse queries one Software Engineer run may send (docs/17-executive-team.md §22.9). */
export const ENGINEERING_QUERY_LIMIT_MAX = 10;

/** The environments the Software Engineer reads and changes flags in (§22.9). */
export const FLAG_ENVIRONMENTS = ["TEST", "PROD"] as const;
export const FlagEnvironmentSchema = z.enum(FLAG_ENVIRONMENTS);
export type FlagEnvironment = z.infer<typeof FlagEnvironmentSchema>;

/*
 * What the boroughsim-engineering MCP server reads from its environment
 * (docs/17-executive-team.md §22.9): the ops client's sign-in, which is
 * AGENT_ENV's (PROD unless set) and serves queries; the run's query budget,
 * capped; and optionally a sign-in to the other environment (AGENT_OTHER_*),
 * so flags can be read and changed in both Test and Prod.
 */
export const EngineeringClientConfigSchema = OpsClientConfigSchema.extend({
  ENGINEERING_QUERY_LIMIT: z.coerce.number().int().min(0).max(ENGINEERING_QUERY_LIMIT_MAX).optional(),
  AGENT_ENV: FlagEnvironmentSchema.default("PROD"),
  AGENT_OTHER_API_URL: z.string().url().optional(),
  AGENT_OTHER_ID_TOKEN: z.string().min(1).optional(),
  AGENT_OTHER_REFRESH_TOKEN: z.string().min(1).optional(),
  AGENT_OTHER_CLIENT_ID: z.string().min(1).optional(),
});
export type EngineeringClientConfig = z.input<typeof EngineeringClientConfigSchema>;
