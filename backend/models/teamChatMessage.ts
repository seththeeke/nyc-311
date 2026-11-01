import { z } from "zod";
import { TEAM_CHAT_MEMBER_KINDS } from "./teamChatMember";

/* docs/17-executive-team.md §10.2. */
export const TEAM_CHAT_REACTION_EMOJIS = ["👍", "✅", "🎉", "🚀", "👀", "💰"] as const;
export const TEAM_CHAT_TEXT_MAX = 4000;
export const TEAM_CHAT_TAGS_MAX = 10;
export const TEAM_CHAT_MENTION_CHANNEL = "CHANNEL";

const TagSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/);

/* DynamoDB hands string sets back as Set; the API speaks sorted arrays. */
function setToArray(value: unknown): unknown {
  return value instanceof Set ? [...value].sort() : value;
}

const MemberListSchema = z.preprocess(setToArray, z.array(z.string()));

export const TeamChatMessageSchema = z.object({
  /* A ULID, so ids sort by time. */
  message_id: z.string().min(1),
  channel_id: z.string().min(1),
  /* Null for a top-level post, or the root's message_id for a reply. */
  thread_id: z.string().nullable(),
  author_id: z.string().min(1),
  author_kind: z.enum(TEAM_CHAT_MEMBER_KINDS),
  /* Markdown subset; empty only on a deleted message. */
  text: z.string().max(TEAM_CHAT_TEXT_MAX),
  tags: z.array(TagSchema).max(TEAM_CHAT_TAGS_MAX),
  /* Member ids, or CHANNEL for everyone; parsed by the server. */
  mentions: z.array(z.string()),
  /* Emoji to the members who reacted; the count is the list's length. */
  reactions: z.preprocess(
    (value) => (value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([emoji, members]) => [emoji, setToArray(members)])) : value),
    z.record(z.string(), z.array(z.string()))
  ),
  reply_count: z.number().int().nonnegative(),
  last_reply_at: z.string().nullable(),
  reply_author_ids: MemberListSchema.default([]),
  created_at: z.string().min(1),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});
export type TeamChatMessage = z.infer<typeof TeamChatMessageSchema>;

/* Body of a post or a reply. */
export const TeamChatPostBodySchema = z.object({
  text: z.string().trim().min(1).max(TEAM_CHAT_TEXT_MAX),
  tags: z.array(TagSchema).max(TEAM_CHAT_TAGS_MAX).default([]),
  /* The caller's retry key: a replay returns the original message. */
  client_token: z.string().min(8).max(64),
});
export type TeamChatPostBody = z.infer<typeof TeamChatPostBodySchema>;

export const TeamChatEditBodySchema = z.object({
  text: z.string().trim().min(1).max(TEAM_CHAT_TEXT_MAX),
});
export type TeamChatEditBody = z.infer<typeof TeamChatEditBodySchema>;

export const TeamChatReactionEmojiSchema = z.enum(TEAM_CHAT_REACTION_EMOJIS);
export type TeamChatReactionEmoji = z.infer<typeof TeamChatReactionEmojiSchema>;
