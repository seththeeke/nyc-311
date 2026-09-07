import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { warehouseDataService } from "../services/warehouseDataService";
import type { JobResult } from "../models/jobResult";

export function jobResultQueryKey(jobName: string): readonly [string, string] {
  return ["jobResult", jobName] as const;
}

/*
 * Fixed 30s poll, matching useWarehouseJobRuns.ts — a newly-completed job
 * run replaces its result.json, and the Results view should pick it up
 * without a manual refresh. TanStack Query only polls while a component
 * using this hook is mounted.
 */
const REFETCH_INTERVAL_MS = 30_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useJobResult(jobName: string): UseQueryResult<JobResult, Error> {
  return useQuery({
    queryKey: jobResultQueryKey(jobName),
    queryFn: () => warehouseDataService.getJobResult(jobName),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
