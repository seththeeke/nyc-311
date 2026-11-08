import { useQuery } from "@tanstack/react-query";
import { config } from "../config.ts";
import { getAgent, listAgents } from "../services/agentService.ts";
import { getServerHealth, listWorktrees } from "../services/machineService.ts";
import { getRun, listRuns, readRunLog } from "../services/runService.ts";

/* One hook per read (CLAUDE.md §5.1: components call hooks, never services). Everything polls; a running run polls faster. */

export function useAgents() {
  return useQuery({ queryKey: ["agents"], queryFn: listAgents, refetchInterval: config.refreshMs });
}

export function useAgent(name: string) {
  return useQuery({ queryKey: ["agent", name], queryFn: () => getAgent(name), refetchInterval: config.refreshMs });
}

export function useRuns(agent: string, limit: number) {
  return useQuery({ queryKey: ["runs", agent, limit], queryFn: () => listRuns(agent, limit), refetchInterval: config.refreshMs });
}

export function useRun(agent: string, runId: string) {
  return useQuery({
    queryKey: ["run", agent, runId],
    queryFn: () => getRun(agent, runId),
    refetchInterval: (query) => (query.state.data?.status === "RUNNING" ? config.liveMs : false),
  });
}

/** The whole log each poll: run logs are a few KB, so the offset API is kept for later rather than stitched together here. */
export function useRunLog(agent: string, runId: string, live: boolean) {
  return useQuery({ queryKey: ["runLog", agent, runId], queryFn: () => readRunLog(agent, runId), refetchInterval: live ? config.liveMs : false });
}

export function useServerHealth() {
  return useQuery({ queryKey: ["health"], queryFn: getServerHealth, refetchInterval: config.refreshMs });
}

export function useWorktrees() {
  return useQuery({ queryKey: ["worktrees"], queryFn: listWorktrees, refetchInterval: config.refreshMs });
}
