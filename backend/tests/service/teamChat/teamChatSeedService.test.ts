import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamChatDao } from "../../../dao/teamChat/teamChatDao";
import { syncTeamChatSeeds } from "../../../service/teamChat/teamChatSeedService";
import { teamChatSeeds } from "../../../service/teamChat/teamChatSeeds";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncTeamChatSeeds", () => {
  it("upserts every member before any channel and returns the counts", async () => {
    const order: string[] = [];
    const dao = {
      upsertMember: vi.fn(async (seed: { member_id: string }) => void order.push(`member:${seed.member_id}`)),
      upsertChannel: vi.fn(async (seed: { channel_id: string }) => void order.push(`channel:${seed.channel_id}`)),
    } as unknown as TeamChatDao;
    expect(await syncTeamChatSeeds(teamChatSeeds("PROD"), { dao })).toEqual({ members: "8", channels: "3" });
    expect(order.indexOf("channel:executive-team")).toBeGreaterThan(order.indexOf("member:gen-dev"));
  });

  it("builds its DAO from TEAM_CHAT_TABLE_NAME", async () => {
    const saved = process.env.TEAM_CHAT_TABLE_NAME;
    delete process.env.TEAM_CHAT_TABLE_NAME;
    await expect(syncTeamChatSeeds({ members: [], channels: [] })).rejects.toThrow("TEAM_CHAT_TABLE_NAME");
    if (saved !== undefined) process.env.TEAM_CHAT_TABLE_NAME = saved;
  });
});
