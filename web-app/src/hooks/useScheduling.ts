import { useMutation } from "@tanstack/react-query";
import { schedulingService } from "../services/schedulingService";

export interface UseSchedulingResult {
  runScheduling: () => Promise<void>;
  isRunning: boolean;
  error: Error | null;
  isSuccess: boolean;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * `SchedulingManagementPage` (`10-capacity-modeling-and-integration.md`
 * §5.1) — an on-demand trigger only, no status query (no persisted stats
 * exist yet to poll).
 */
export function useScheduling(): UseSchedulingResult {
  const mutation = useMutation<void, Error>({
    mutationFn: () => schedulingService.runScheduling(),
  });

  return {
    runScheduling: () => mutation.mutateAsync(),
    isRunning: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  };
}
