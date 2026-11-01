import { TEAM_CHAT_MENTION_CHANNEL } from "../../models/teamChatMessage";
import type { TeamChatMember } from "../../models/teamChatMember";

/**
 * The mentions in a message (docs/17-executive-team.md §10.2): `@channel`
 * becomes CHANNEL, and `@<handle>` the member id of a channel member with
 * that handle, matched case-insensitively. Anything else is plain text.
 */
export function parseMentions(text: string, channelMembers: readonly TeamChatMember[]): string[] {
  const byHandle = new Map(channelMembers.map((member) => [member.handle.toLowerCase(), member.member_id]));
  const mentions = new Set<string>();
  for (const match of text.matchAll(/(?<![\w@])@([A-Za-z]+)/g)) {
    const handle = match[1].toLowerCase();
    const memberId = handle === "channel" ? TEAM_CHAT_MENTION_CHANNEL : byHandle.get(handle);
    if (memberId) mentions.add(memberId);
  }
  return [...mentions];
}
