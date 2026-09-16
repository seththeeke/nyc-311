import { useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseJobDefinitionService } from "../services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../models/warehouseJobDefinition";
import { WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY } from "./useWarehouseJobDefinitions";

export interface UseUpdateWarehouseJobResult {
  /** `cadenceCron` is ignored server-side when the job is a saved query (it has no schedule). */
  updateJob: (name: string, sql: string, cadenceCron?: string) => Promise<WarehouseJobDefinition>;
  isUpdating: boolean;
  error: Error | null;
}

interface UpdateWarehouseJobInput {
  name: string;
  sql: string;
  cadenceCron?: string;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * the query editor's "save changes back to this job" flow
 * (`7-data-warehousing.md` §12b's job-edit flow) — overwrites an existing
 * job's SQL/cadence in place, unlike {@link useCreateWarehouseJob}'s
 * always-a-new-job behavior. Invalidates the job definition list on
 * success so the updated cadence/timestamp reflect immediately.
 */
export function useUpdateWarehouseJob(): UseUpdateWarehouseJobResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<WarehouseJobDefinition, Error, UpdateWarehouseJobInput>({
    mutationFn: ({ name, sql, cadenceCron }) => warehouseJobDefinitionService.updateJob(name, sql, cadenceCron),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY });
    },
  });

  return {
    updateJob: (name, sql, cadenceCron) => mutation.mutateAsync({ name, sql, cadenceCron }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}
