import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { pollerMetricsService } from "../services/pollerMetricsService";
import type { PollerMetrics } from "../models/pollerMetrics";

export const POLLER_METRICS_QUERY_KEY = ["pollerMetrics"] as const;

/*
 * The poller runs on a 6h EventBridge schedule (1-data-ingestion.md §5), so
 * there's no need to poll aggressively — a 60s refetch interval is enough
 * for an open dashboard tab to eventually pick up a new run without
 * requiring a manual refresh.
 */
const REFETCH_INTERVAL_MS = 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function usePollerMetrics(): UseQueryResult<PollerMetrics[], Error> {
  return useQuery({
    queryKey: POLLER_METRICS_QUERY_KEY,
    queryFn: () => pollerMetricsService.listPollerMetrics(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
