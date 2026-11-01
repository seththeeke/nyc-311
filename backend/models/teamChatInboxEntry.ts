import { z } from "zod";

export const TEAM_CHAT_INBOX_KINDS = ["MENTION", "THREAD_REPLY"] as const;

/* One thing a member should look at (docs/17-executive-team.md §10.3): a mention, or a reply in a thread they're in. */
export const TeamChatInboxEntrySchema = z.object({
  member_id: z.string().min(1),
  /* A ULID; the inbox reads in this order. */
  entry_id: z.string().min(1),
  kind: z.enum(TEAM_CHAT_INBOX_KINDS),
  channel_id: z.string().min(1),
  message_id: z.string().min(1),
  thread_id: z.string().nullable(),
  author_id: z.string().min(1),
  created_at: z.string().min(1),
});
export type TeamChatInboxEntry = z.infer<typeof TeamChatInboxEntrySchema>;

export const TeamChatInboxReadBodySchema = z.object({ entry_id: z.string().min(1) });
export type TeamChatInboxReadBody = z.infer<typeof TeamChatInboxReadBodySchema>;
