import { serverHealthSchema, type ServerHealth } from "../../shared/models/serverHealth.ts";
import { worktreeListSchema, type Worktree } from "../../shared/models/worktree.ts";
import { getJson } from "./apiClient.ts";

export function getServerHealth(): Promise<ServerHealth> {
  return getJson("/health", serverHealthSchema);
}

export function listWorktrees(): Promise<Worktree[]> {
  return getJson("/worktrees", worktreeListSchema);
}
