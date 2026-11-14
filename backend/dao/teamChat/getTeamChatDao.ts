import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { TeamChatDao } from "./teamChatDao";

/**
 * Builds a fresh `TeamChatDao` on every call, reading `TEAM_CHAT_TABLE_NAME`
 * only then: the one place that names this table's env var (§5.2: lazy,
 * never module scope).
 */
export function getTeamChatDao(): TeamChatDao {
  return new TeamChatDao(createDocumentClient(), requireEnv("TEAM_CHAT_TABLE_NAME"));
}
