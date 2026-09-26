import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { workspaceMetricsService } from "../services/workspaceMetricsService";
import type { WorkspaceMetrics } from "../models/workspaceMetrics";

export const WORKSPACE_METRICS_QUERY_KEY = ["workspaceMetrics"] as const;

/* The source report runs daily — a 5-minute poll is plenty. Every metric tile shares this one query. */
const REFETCH_INTERVAL_MS = 5 * 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useWorkspaceMetrics(): UseQueryResult<WorkspaceMetrics, Error> {
  return useQuery({
    queryKey: WORKSPACE_METRICS_QUERY_KEY,
    queryFn: () => workspaceMetricsService.getWorkspaceMetrics(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
