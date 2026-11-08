import path from "node:path";
import type { Worktree } from "../../shared/models/worktree.ts";
import { logInfo } from "../logger.ts";
import { countDirty, listWorktrees as readWorktrees } from "../source/gitSource.ts";
import { resolveDeps, type ServiceDeps } from "./deps.ts";

/** `<agent>-<epoch>-<rand>`, the name agent-worktree.sh gives a run's worktree. */
const RUN_WORKTREE = /^([a-z][a-z0-9-]*?)-(\d{9,})-[0-9a-f]{4}$/;

/** Worktrees of the scheduler clone and the primary checkout (once each if they're the same). */
export async function listWorktrees(serviceDeps: ServiceDeps): Promise<Worktree[]> {
  const { config, run } = resolveDeps(serviceDeps);
  const checkouts = [...new Set([config.schedulerClone, config.primaryCheckout])];
  const worktrees: Worktree[] = [];
  for (const checkout of checkouts) {
    for (const worktree of await readWorktrees(checkout, run)) {
      const name = RUN_WORKTREE.exec(path.basename(worktree.path));
      worktrees.push({
        checkout,
        path: worktree.path,
        branch: worktree.branch,
        head: worktree.head,
        dirtyCount: await countDirty(worktree.path, run),
        agent: name ? name[1] : null,
        createdAt: name ? new Date(Number(name[2]) * 1000).toISOString() : null,
        isPrimary: worktree.path === checkout,
      });
    }
  }
  logInfo("listed worktrees", { checkouts, count: worktrees.length });
  return worktrees;
}
