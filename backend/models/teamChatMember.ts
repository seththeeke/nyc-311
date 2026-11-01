import { z } from "zod";

/* Who can act in Team Chat (docs/17-executive-team.md §10.2): the CEO or an agent. Seeded, never created through the API. */
export const TEAM_CHAT_MEMBER_KINDS = ["HUMAN", "AGENT"] as const;
export const TEAM_CHAT_MEMBER_STATUSES = ["ACTIVE", "DISABLED"] as const;

export const TeamChatMemberSchema = z.object({
  /* Matches the web-app roster's member_id. */
  member_id: z.string().regex(/^[a-z0-9-]+$/),
  /* The @ handle, without the @: Seth, Pip, Brogan. */
  handle: z.string().regex(/^[A-Za-z]+$/),
  kind: z.enum(TEAM_CHAT_MEMBER_KINDS),
  /* The ID token's email claim that resolves to this member; null for a member who can't sign in yet. */
  email: z.string().email().nullable(),
  status: z.enum(TEAM_CHAT_MEMBER_STATUSES),
  /* The newest inbox entry the member has read. */
  inbox_read_id: z.string().nullable(),
});
export type TeamChatMember = z.infer<typeof TeamChatMemberSchema>;

/* What the seeds define; inbox_read_id is the member's own state, never overwritten by a sync. */
export type TeamChatMemberSeed = Omit<TeamChatMember, "inbox_read_id">;
