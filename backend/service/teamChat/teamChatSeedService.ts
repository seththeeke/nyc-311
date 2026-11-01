import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo } from "../../logger";
import { TeamChatDao } from "../../dao/teamChat/teamChatDao";
import type { TeamChatSeeds } from "./teamChatSeeds";

export interface TeamChatSeedServiceDeps {
  dao?: TeamChatDao;
}

/**
 * Writes every seeded member and channel (docs/17-executive-team.md §10.2),
 * keeping the state posts and reads own. Members first, so a channel never
 * lists a member that doesn't exist yet.
 */
export async function syncTeamChatSeeds(seeds: TeamChatSeeds, deps: TeamChatSeedServiceDeps = {}): Promise<{ members: string; channels: string }> {
  const dao = deps.dao ?? new TeamChatDao(createDocumentClient(), requireEnv("TEAM_CHAT_TABLE_NAME"));
  for (const member of seeds.members) {
    await dao.upsertMember(member);
    logInfo("TeamChatSeedService.memberSynced", { memberId: member.member_id });
  }
  for (const channel of seeds.channels) {
    await dao.upsertChannel(channel);
    logInfo("TeamChatSeedService.channelSynced", { channelId: channel.channel_id });
  }
  return { members: String(seeds.members.length), channels: String(seeds.channels.length) };
}
