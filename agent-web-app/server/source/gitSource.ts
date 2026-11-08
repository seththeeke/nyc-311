import type { CommandRunner } from "./commandRunner.ts";

export interface PorcelainWorktree {
  path: string;
  head: string | null;
  branch: string | null;
}

/** `git worktree list --porcelain` for a checkout, parsed; empty when git fails. */
export async function listWorktrees(checkout: string, run: CommandRunner): Promise<PorcelainWorktree[]> {
  const result = await run("git", ["-C", checkout, "worktree", "list", "--porcelain"]);
  if (result.code !== 0) return [];
  const worktrees: PorcelainWorktree[] = [];
  for (const block of result.stdout.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const pathLine = lines.find((line) => line.startsWith("worktree "));
    if (!pathLine) continue;
    const head = lines.find((line) => line.startsWith("HEAD "));
    const branch = lines.find((line) => line.startsWith("branch "));
    worktrees.push({
      path: pathLine.slice("worktree ".length),
      head: head ? head.slice("HEAD ".length, "HEAD ".length + 7) : null,
      branch: branch ? branch.slice("branch ".length).replace(/^refs\/heads\//, "") : null,
    });
  }
  return worktrees;
}

/** Number of changed or untracked files in a working tree; 0 when git fails. */
export async function countDirty(dir: string, run: CommandRunner): Promise<number> {
  const result = await run("git", ["-C", dir, "status", "--porcelain"]);
  if (result.code !== 0) return 0;
  return result.stdout.split("\n").filter((line) => line.trim() !== "").length;
}

/** The checked-out branch, or null when detached or git fails. */
export async function currentBranch(dir: string, run: CommandRunner): Promise<string | null> {
  const result = await run("git", ["-C", dir, "branch", "--show-current"]);
  const branch = result.stdout.trim();
  return result.code === 0 && branch !== "" ? branch : null;
}
