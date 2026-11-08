import { describe, expect, it } from "vitest";
import { getAgent, listAgents } from "../../../web/services/agentService.ts";
import { getServerHealth, listWorktrees } from "../../../web/services/machineService.ts";
import { getRun, listRuns, readRunLog } from "../../../web/services/runService.ts";
import { makeAgent, makeHealth, makeRun, makeRunDetail, makeWorktree, stubApi } from "../fixtures.tsx";

describe("services", () => {
  it("call the read-only API paths", async () => {
    stubApi({
      "/agents": [makeAgent()],
      "/agents/cto-agent": makeAgent(),
      "/agents/cto-agent/runs?limit=5": [makeRun()],
      "/agents/cto-agent/runs/20261107T140004": makeRunDetail(),
      "/agents/cto-agent/runs/20261107T140004/log?offset=7": { text: "x", offset: 7, nextOffset: 8 },
      "/health": makeHealth(),
      "/worktrees": [makeWorktree()],
    });
    expect(await listAgents()).toHaveLength(1);
    expect((await getAgent("cto-agent")).config.name).toBe("cto-agent");
    expect(await listRuns("cto-agent", 5)).toHaveLength(1);
    expect((await getRun("cto-agent", "20261107T140004")).report).toContain("Final Report");
    expect((await readRunLog("cto-agent", "20261107T140004", 7)).nextOffset).toBe(8);
    expect((await getServerHealth()).ok).toBe(true);
    expect(await listWorktrees()).toHaveLength(1);
  });
});
