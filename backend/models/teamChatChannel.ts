import { z } from "zod";

export const TEAM_CHAT_CHANNEL_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export const TEAM_CHAT_CHANNEL_MAX_MEMBERS = 50;

/* A named conversation with a fixed member list (docs/17-executive-team.md §10.2). Seeded by the stack. */
export const TeamChatChannelSchema = z.object({
  channel_id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  topic: z.string(),
  member_ids: z.array(z.string().min(1)).max(TEAM_CHAT_CHANNEL_MAX_MEMBERS),
  visibility: z.enum(TEAM_CHAT_CHANNEL_VISIBILITIES),
  last_message_id: z.string().nullable(),
  last_message_at: z.string().nullable(),
});
export type TeamChatChannel = z.infer<typeof TeamChatChannelSchema>;

/* What the seeds define; the last_message_* fields are written by posts, never by a sync. */
export type TeamChatChannelSeed = Omit<TeamChatChannel, "last_message_id" | "last_message_at">;
