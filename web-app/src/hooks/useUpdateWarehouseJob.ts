import { useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseJobDefinitionService } from "../services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../models/warehouseJobDefinition";
import { WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY } from "./useWarehouseJobDefinitions";

export interface UseUpdateWarehouseJobResult {
  updateJob: (name: string, cadenceCron: string, sql: string) => Promise<WarehouseJobDefinition>;
  isUpdating: boolean;
  error: Error | null;
}

interface UpdateWarehouseJobInput {
  name: string;
  cadenceCron: string;
  sql: string;
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
    mutationFn: ({ name, cadenceCron, sql }) => warehouseJobDefinitionService.updateJob(name, cadenceCron, sql),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY });
    },
  });

  return {
    updateJob: (name, cadenceCron, sql) => mutation.mutateAsync({ name, cadenceCron, sql }),
    isUpdating: mutation.isPending,
    error: mutation.error,
  };
}
