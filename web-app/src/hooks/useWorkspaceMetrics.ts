import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { workspaceMetricsService } from "../services/workspaceMetricsService";
import type { WorkspaceMetrics, WorkspaceMetricsSource } from "../models/workspaceMetrics";

export const WORKSPACE_METRICS_QUERY_KEY = ["workspaceMetrics"] as const;

/* The wbr report runs daily — a 5-minute poll is plenty. */
const WBR_REFETCH_INTERVAL_MS = 5 * 60_000;
/* Live values move with every accepted/resolved Order — same cadence as the fleet map (useFleetLocations), so the two agree. */
const LIVE_REFETCH_INTERVAL_MS = 15_000;

/** How often to re-poll, given the source of the last response (`undefined` before the first one lands). */
export function workspaceMetricsRefetchInterval(source: WorkspaceMetricsSource | undefined): number {
  return source === "LIVE" ? LIVE_REFETCH_INTERVAL_MS : WBR_REFETCH_INTERVAL_MS;
}

/** Components call hooks, never services, directly (CLAUDE.md §5.1). Every metric tile shares this one query. */
export function useWorkspaceMetrics(): UseQueryResult<WorkspaceMetrics, Error> {
  return useQuery({
    queryKey: WORKSPACE_METRICS_QUERY_KEY,
    queryFn: () => workspaceMetricsService.getWorkspaceMetrics(),
    refetchInterval: (query) => workspaceMetricsRefetchInterval(query.state.data?.source),
  });
}
