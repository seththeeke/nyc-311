import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { pipelineStatusService } from "../services/pipelineStatusService";
import type { PipelineStatusResponse } from "../models/pipelineStatus";

export const PIPELINE_STATUS_QUERY_KEY = ["pipelineStatus"] as const;

/*
 * 2-pipeline-monitoring.md §8: fixed 30s poll, no adaptive/background
 * logic needed — TanStack Query only polls while mounted and defaults
 * refetchIntervalInBackground to false, so "keep the browser light" is
 * structural as long as this hook is only called from
 * PipelineMonitoringPage.
 */
const REFETCH_INTERVAL_MS = 30_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function usePipelineStatus(): UseQueryResult<PipelineStatusResponse, Error> {
  return useQuery({
    queryKey: PIPELINE_STATUS_QUERY_KEY,
    queryFn: () => pipelineStatusService.getPipelineStatus(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
