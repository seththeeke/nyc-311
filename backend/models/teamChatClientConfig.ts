import { z } from "zod";

/*
 * What the team-chat MCP server reads from its environment
 * (docs/17-executive-team.md §10.7). The run script writes these into the
 * per-run MCP config; the agent's own process never sees them.
 */
export const TeamChatClientConfigSchema = z.object({
  TEAM_CHAT_API_URL: z.string().url(),
  TEAM_CHAT_ID_TOKEN: z.string().min(1),
  TEAM_CHAT_REFRESH_TOKEN: z.string().min(1),
  TEAM_CHAT_CLIENT_ID: z.string().min(1),
  TEAM_CHAT_REGION: z.string().min(1),
});
export type TeamChatClientConfig = z.infer<typeof TeamChatClientConfigSchema>;
