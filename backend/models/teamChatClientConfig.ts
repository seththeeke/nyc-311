import { z } from "zod";

/** A top-level post's word cap unless the run sets another (docs/17-executive-team.md §21.2). */
export const TEAM_CHAT_POST_WORDS_DEFAULT = 75;

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
  /* The most words a top-level post may have (§21.2); 0 is no cap. Replies are never capped. */
  TEAM_CHAT_POST_WORDS: z.coerce.number().int().min(0).default(TEAM_CHAT_POST_WORDS_DEFAULT),
});
export type TeamChatClientConfig = z.infer<typeof TeamChatClientConfigSchema>;
