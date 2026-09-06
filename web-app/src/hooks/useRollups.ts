import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { warehouseDataService } from "../services/warehouseDataService";
import type { AnalyticsRollupListResponse } from "../models/analyticsRollup";

export const ROLLUPS_QUERY_KEY = ["analyticsRollups"] as const;

/*
 * Fixed 30s poll, matching useWarehouseJobRuns.ts — a newly-completed job
 * run writes fresh rollup rows, and the inspection view should pick them
 * up without a manual refresh. TanStack Query only polls while a component
 * using this hook is mounted.
 */
const REFETCH_INTERVAL_MS = 30_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useRollups(): UseQueryResult<AnalyticsRollupListResponse, Error> {
  return useQuery({
    queryKey: ROLLUPS_QUERY_KEY,
    queryFn: () => warehouseDataService.getRollups(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
