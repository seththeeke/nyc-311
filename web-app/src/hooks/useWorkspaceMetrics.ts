import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { workspaceMetricsService } from "../services/workspaceMetricsService";
import type { WorkspaceMetrics } from "../models/workspaceMetrics";

export const WORKSPACE_METRICS_QUERY_KEY = ["workspaceMetrics"] as const;

/* Values move with every accepted/resolved Order — same cadence as the fleet map (useFleetLocations), so the two agree. */
export const WORKSPACE_METRICS_REFETCH_INTERVAL_MS = 15_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). Every metric tile shares this one query. */
export function useWorkspaceMetrics(): UseQueryResult<WorkspaceMetrics, Error> {
  return useQuery({
    queryKey: WORKSPACE_METRICS_QUERY_KEY,
    queryFn: () => workspaceMetricsService.getWorkspaceMetrics(),
    refetchInterval: WORKSPACE_METRICS_REFETCH_INTERVAL_MS,
  });
}
