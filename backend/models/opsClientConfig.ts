import { z } from "zod";

/*
 * What the boroughsim-ops MCP server reads from its environment
 * (docs/17-executive-team.md §12.4), written by the run script into the
 * per-run MCP config beside team-chat's.
 */
export const OpsClientConfigSchema = z.object({
  BOROUGH_SIM_API_URL: z.string().url(),
  AGENT_ID_TOKEN: z.string().min(1),
  AGENT_REFRESH_TOKEN: z.string().min(1),
  AGENT_CLIENT_ID: z.string().min(1),
  AGENT_REGION: z.string().min(1),
});
export type OpsClientConfig = z.infer<typeof OpsClientConfigSchema>;
