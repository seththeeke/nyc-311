import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { lambdaMetricsService } from "../services/lambdaMetricsService";
import type { LambdaHealth } from "../models/lambdaMetrics";

export const LAMBDA_METRICS_QUERY_KEY = ["lambdaMetrics"] as const;

/* Matches usePollerMetrics.ts's 60s cadence — no need to poll more aggressively than the data itself changes. */
const REFETCH_INTERVAL_MS = 60_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useLambdaMetrics(): UseQueryResult<LambdaHealth[], Error> {
  return useQuery({
    queryKey: LAMBDA_METRICS_QUERY_KEY,
    queryFn: () => lambdaMetricsService.listLambdaHealth(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
