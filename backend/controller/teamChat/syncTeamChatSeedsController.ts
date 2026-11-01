import { logError, logInfo } from "../../logger";
import { requireEnv } from "../../env";
import { TeamChatSeedSyncEventSchema } from "../../models/teamChatSeedSyncEvent";
import { teamChatSeeds, type TeamChatSeedEnv } from "../../service/teamChat/teamChatSeeds";
import { syncTeamChatSeeds } from "../../service/teamChat/teamChatSeedService";

/* One fixed id: the sync is a single logical resource, so CloudFormation never sees a replacement. */
export const TEAM_CHAT_SEED_SYNC_RESOURCE_ID = "team-chat-seed-sync";

export interface TeamChatSeedSyncResponse {
  PhysicalResourceId: string;
  Data?: Record<string, string>;
}

/**
 * The Team Chat seed sync custom resource (docs/17-executive-team.md §10.2),
 * run on every deploy. A thrown error fails the deploy. Delete does
 * nothing: members, channels and messages outlive the resource.
 */
export const syncTeamChatSeedsController = async (event: unknown): Promise<TeamChatSeedSyncResponse> => {
  logInfo("SyncTeamChatSeedsControllerInvoked", { event });
  const parsed = TeamChatSeedSyncEventSchema.safeParse(event);
  if (!parsed.success) {
    logError("SyncTeamChatSeedsControllerValidationFailed", { issues: parsed.error.issues });
    throw new Error("Malformed custom resource event");
  }
  if (parsed.data.RequestType === "Delete") {
    logInfo("SyncTeamChatSeedsControllerDeleteIgnored", {});
    return { PhysicalResourceId: TEAM_CHAT_SEED_SYNC_RESOURCE_ID };
  }
  const env = requireEnv("TEAM_CHAT_ENV");
  if (env !== "TEST" && env !== "PROD") throw new Error(`TEAM_CHAT_ENV must be TEST or PROD, got ${env}`);
  const counts = await syncTeamChatSeeds(teamChatSeeds(env satisfies TeamChatSeedEnv));
  const response = { PhysicalResourceId: TEAM_CHAT_SEED_SYNC_RESOURCE_ID, Data: counts };
  logInfo("SyncTeamChatSeedsControllerCompleted", { response });
  return response;
};
