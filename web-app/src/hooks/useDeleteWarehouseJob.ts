import { useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseJobDefinitionService } from "../services/warehouseJobDefinitionService";
import { WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY } from "./useWarehouseJobDefinitions";

export interface UseDeleteWarehouseJobResult {
  deleteJob: (name: string) => Promise<void>;
  isDeleting: boolean;
  error: Error | null;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * the Jobs tab's per-row Delete action (7-data-warehousing.md §12b, Leg
 * 8). Invalidates the job definition list on success; run history is left
 * untouched (§8's "keep history" design call — nothing to invalidate there).
 */
export function useDeleteWarehouseJob(): UseDeleteWarehouseJobResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, string>({
    mutationFn: (name) => warehouseJobDefinitionService.deleteJob(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY });
    },
  });

  return {
    deleteJob: (name) => mutation.mutateAsync(name),
    isDeleting: mutation.isPending,
    error: mutation.error,
  };
}
