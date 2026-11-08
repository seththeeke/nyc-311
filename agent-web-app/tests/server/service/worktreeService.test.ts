import { describe, expect, it } from "vitest";
import { listWorktrees } from "../../../server/service/worktreeService.ts";
import { fixtureConfig, fixtureText, stubRunner } from "../fixtures.ts";

describe("listWorktrees", () => {
  it("lists both checkouts' worktrees with dirty counts and run-worktree names", async () => {
    const config = fixtureConfig({ schedulerClone: "/Users/x/agents/nyc-311", primaryCheckout: "/Users/x/docs/nyc-311" });
    const run = stubRunner({
      "git -C /Users/x/agents/nyc-311 worktree list": { stdout: fixtureText("worktreePorcelain.txt"), code: 0 },
      "git -C /Users/x/agents/nyc-311-worktrees/beta-agent-1793757607-51d4 status": { stdout: " M x\n", code: 0 },
    });
    const worktrees = await listWorktrees({ config, run });
    expect(worktrees).toHaveLength(3);
    expect(worktrees[0]).toMatchObject({ isPrimary: true, agent: null, branch: "main", dirtyCount: 0 });
    expect(worktrees[1]).toMatchObject({ isPrimary: false, agent: "beta-agent", dirtyCount: 1, createdAt: new Date(1793757607 * 1000).toISOString() });
    expect(worktrees[2]).toMatchObject({ agent: null, createdAt: null });
    expect(run.calls.some((call) => call.startsWith("git -C /Users/x/docs/nyc-311 worktree"))).toBe(true);
  });

  it("reads one checkout once when both paths are the same", async () => {
    const run = stubRunner({});
    await listWorktrees({ config: fixtureConfig(), run });
    expect(run.calls).toHaveLength(1);
  });
});
