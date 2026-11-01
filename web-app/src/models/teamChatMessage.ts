import { z } from "zod";

/* A Team Chat message (docs/17-executive-team.md §10.2): a top-level post, or a reply when thread_id is set. */
export const TeamChatMessageSchema = z.object({
  message_id: z.string().min(1),
  channel_id: z.string().min(1),
  thread_id: z.string().nullable(),
  author_id: z.string().min(1),
  author_kind: z.enum(["HUMAN", "AGENT"]),
  /* Markdown subset; empty on a deleted message. */
  text: z.string(),
  tags: z.array(z.string()),
  mentions: z.array(z.string()),
  /* Emoji to the members who reacted. */
  reactions: z.record(z.string(), z.array(z.string())),
  reply_count: z.number().int().nonnegative(),
  last_reply_at: z.string().nullable(),
  reply_author_ids: z.array(z.string()),
  created_at: z.string().min(1),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});
export type TeamChatMessage = z.infer<typeof TeamChatMessageSchema>;

export const TeamChatMessagePageSchema = z.object({ items: z.array(TeamChatMessageSchema), next_cursor: z.string().nullable() });
export type TeamChatMessagePage = z.infer<typeof TeamChatMessagePageSchema>;

export const TeamChatThreadSchema = z.object({ root: TeamChatMessageSchema, replies: TeamChatMessagePageSchema });
export type TeamChatThread = z.infer<typeof TeamChatThreadSchema>;
