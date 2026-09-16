import { useMutation } from "@tanstack/react-query";
import { warehouseJobRunResultsService } from "../services/warehouseJobRunResultsService";
import type { JobRunResultItem } from "../models/jobRunResults";

export interface UseJobRunResultsResult {
  loadResults: (jobRunIds: string[]) => Promise<JobRunResultItem[]>;
  results: JobRunResultItem[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * the admin Reports tab's run picker — an on-demand fetch triggered by
 * selecting a run, not data the page needs as soon as it renders, so this
 * is a mutation (like {@link useJobSql}'s `loadSql`), not a query.
 * `results` is always an array, ready for a future multi-select dashboard
 * view without a second hook.
 */
export function useJobRunResults(): UseJobRunResultsResult {
  const mutation = useMutation<JobRunResultItem[], Error, string[]>({
    mutationFn: (jobRunIds) => warehouseJobRunResultsService.getJobRunResults(jobRunIds),
  });

  return {
    loadResults: (jobRunIds) => mutation.mutateAsync(jobRunIds),
    results: mutation.data ?? [],
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
