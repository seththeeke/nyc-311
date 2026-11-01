import { z } from "zod";

/* A Team Chat channel (docs/17-executive-team.md §10.2), as the chat API's open reads return it. */
export const TeamChatChannelSchema = z.object({
  channel_id: z.string().min(1),
  name: z.string().min(1),
  topic: z.string(),
  member_ids: z.array(z.string()),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  last_message_id: z.string().nullable(),
  last_message_at: z.string().nullable(),
});
export type TeamChatChannel = z.infer<typeof TeamChatChannelSchema>;

export const TeamChatChannelListSchema = z.object({ items: z.array(TeamChatChannelSchema) });
