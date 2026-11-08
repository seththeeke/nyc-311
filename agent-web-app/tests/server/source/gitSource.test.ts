import { describe, expect, it } from "vitest";
import { countDirty, currentBranch, listWorktrees } from "../../../server/source/gitSource.ts";
import { fixtureText, stubRunner } from "../fixtures.ts";

describe("gitSource", () => {
  it("parses git worktree list --porcelain", async () => {
    const run = stubRunner({ "git -C /c worktree list --porcelain": { stdout: fixtureText("worktreePorcelain.txt"), code: 0 } });
    expect(await listWorktrees("/c", run)).toEqual([
      { path: "/Users/x/agents/nyc-311", head: "21a530b", branch: "main" },
      { path: "/Users/x/agents/nyc-311-worktrees/beta-agent-1793757607-51d4", head: "35343d8", branch: "devx/157-bump-mcp-sdk" },
      { path: "/Users/x/agents/nyc-311-worktrees/scratch", head: "60cadd5", branch: null },
    ]);
  });

  it("skips blocks without a worktree line and returns nothing when git fails", async () => {
    expect(await listWorktrees("/c", stubRunner({ git: { stdout: "HEAD abc\n\nworktree /w\n", code: 0 } }))).toEqual([{ path: "/w", head: null, branch: null }]);
    expect(await listWorktrees("/c", stubRunner({}))).toEqual([]);
  });

  it("counts dirty files, 0 when git fails", async () => {
    expect(await countDirty("/c", stubRunner({ git: { stdout: " M a\n?? b\n\n", code: 0 } }))).toBe(2);
    expect(await countDirty("/c", stubRunner({}))).toBe(0);
  });

  it("reads the current branch, null when detached or git fails", async () => {
    expect(await currentBranch("/c", stubRunner({ git: { stdout: "main\n", code: 0 } }))).toBe("main");
    expect(await currentBranch("/c", stubRunner({ git: { stdout: "\n", code: 0 } }))).toBeNull();
    expect(await currentBranch("/c", stubRunner({}))).toBeNull();
  });
});
