import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEAM_CHAT_SEED_SYNC_RESOURCE_ID, syncTeamChatSeedsController } from "../../../controller/teamChat/syncTeamChatSeedsController";
import { syncTeamChatSeeds } from "../../../service/teamChat/teamChatSeedService";

vi.mock("../../../service/teamChat/teamChatSeedService", () => ({ syncTeamChatSeeds: vi.fn().mockResolvedValue({ members: "9", channels: "3" }) }));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.TEAM_CHAT_ENV = "TEST";
});

afterEach(() => {
  delete process.env.TEAM_CHAT_ENV;
  vi.restoreAllMocks();
});

describe("syncTeamChatSeedsController", () => {
  it("syncs this environment's seeds on Create and Update", async () => {
    expect(await syncTeamChatSeedsController({ RequestType: "Update" })).toEqual({ PhysicalResourceId: TEAM_CHAT_SEED_SYNC_RESOURCE_ID, Data: { members: "9", channels: "3" } });
    expect(vi.mocked(syncTeamChatSeeds).mock.calls[0][0].channels.map((c) => c.channel_id)).toContain("integration-tests");
  });

  it("does nothing on Delete", async () => {
    vi.mocked(syncTeamChatSeeds).mockClear();
    expect(await syncTeamChatSeedsController({ RequestType: "Delete" })).toEqual({ PhysicalResourceId: TEAM_CHAT_SEED_SYNC_RESOURCE_ID });
    expect(syncTeamChatSeeds).not.toHaveBeenCalled();
  });

  it("throws on a malformed event or an unknown environment", async () => {
    await expect(syncTeamChatSeedsController({})).rejects.toThrow("Malformed");
    process.env.TEAM_CHAT_ENV = "DEV";
    await expect(syncTeamChatSeedsController({ RequestType: "Create" })).rejects.toThrow("TEAM_CHAT_ENV");
  });
});
