import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamChatDao } from "../../../dao/teamChat/teamChatDao";
import { getTeamChatDao } from "../../../dao/teamChat/getTeamChatDao";

describe("getTeamChatDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new TeamChatDao on every call", () => {
    vi.stubEnv("TEAM_CHAT_TABLE_NAME", "TeamChat-Test");
    const dao = getTeamChatDao();
    expect(dao).toBeInstanceOf(TeamChatDao);
    expect(getTeamChatDao()).not.toBe(dao);
  });

  it("throws when TEAM_CHAT_TABLE_NAME is missing", () => {
    vi.stubEnv("TEAM_CHAT_TABLE_NAME", "");
    expect(() => getTeamChatDao()).toThrow("TEAM_CHAT_TABLE_NAME");
  });
});
