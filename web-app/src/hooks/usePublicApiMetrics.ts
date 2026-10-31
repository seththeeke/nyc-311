import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { PublicApiMetrics } from "../models/publicApiMetrics";
import { publicApiMetricsService } from "../services/publicApiMetricsService";

export const PUBLIC_API_METRICS_QUERY_KEY = ["publicApiMetrics"] as const;

/* Hourly data; once a minute is plenty. */
const REFETCH_INTERVAL_MS = 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function usePublicApiMetrics(): UseQueryResult<PublicApiMetrics, Error> {
  return useQuery({
    queryKey: PUBLIC_API_METRICS_QUERY_KEY,
    queryFn: () => publicApiMetricsService.getMetrics(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
