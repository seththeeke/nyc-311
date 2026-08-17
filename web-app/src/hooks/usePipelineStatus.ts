import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { pipelineStatusService } from "../services/pipelineStatusService";
import type { PipelineStatusResponse } from "../models/pipelineStatus";

export const PIPELINE_STATUS_QUERY_KEY = ["pipelineStatus"] as const;

// 2-pipeline-monitoring.md §8: fixed 30s poll, and — deliberately — no
// adaptive/background logic. "Keep the browser light" is satisfied
// structurally, not with bespoke lifecycle code: TanStack Query only
// polls while a component using this hook is mounted (unmount tears the
// interval down automatically) and defaults refetchIntervalInBackground
// to false (a backgrounded tab stops polling on its own). As long as this
// hook is only called from the dedicated PipelineMonitoringPage — never
// from MonitoringPage itself — the poll genuinely only runs while a
// visitor is looking at this specific page.
const REFETCH_INTERVAL_MS = 30_000;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function usePipelineStatus(): UseQueryResult<PipelineStatusResponse, Error> {
  return useQuery({
    queryKey: PIPELINE_STATUS_QUERY_KEY,
    queryFn: () => pipelineStatusService.getPipelineStatus(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
