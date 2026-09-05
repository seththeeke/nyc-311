import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { warehouseDataService } from "../services/warehouseDataService";
import type { WarehouseJobRunListResponse } from "../models/warehouseJobRun";

export const WAREHOUSE_JOB_RUNS_QUERY_KEY = ["warehouseJobRuns"] as const;

/*
 * Fixed 30s poll, same reasoning as usePipelineStatus.ts
 * (2-pipeline-monitoring.md §8) — a RUNNING job run should visibly
 * transition to SUCCEEDED/FAILED without a manual refresh, and TanStack
 * Query only polls while a component using this hook is mounted.
 */
const REFETCH_INTERVAL_MS = 30_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useWarehouseJobRuns(): UseQueryResult<WarehouseJobRunListResponse, Error> {
  return useQuery({
    queryKey: WAREHOUSE_JOB_RUNS_QUERY_KEY,
    queryFn: () => warehouseDataService.getJobRuns(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
