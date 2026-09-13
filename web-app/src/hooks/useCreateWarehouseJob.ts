import { useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseJobDefinitionService } from "../services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../models/warehouseJobDefinition";
import { WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY } from "./useWarehouseJobDefinitions";

export interface UseCreateWarehouseJobResult {
  createJob: (name: string, cadenceCron: string, sql: string) => Promise<WarehouseJobDefinition>;
  isCreating: boolean;
  error: Error | null;
}

interface CreateWarehouseJobInput {
  name: string;
  cadenceCron: string;
  sql: string;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * both the Jobs tab's "New job" form and the Query tab's "Save as job"
 * control (7-data-warehousing.md §12b, Leg 8). Invalidates the job
 * definition list on success so a newly created job appears immediately.
 */
export function useCreateWarehouseJob(): UseCreateWarehouseJobResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<WarehouseJobDefinition, Error, CreateWarehouseJobInput>({
    mutationFn: ({ name, cadenceCron, sql }) => warehouseJobDefinitionService.createJob(name, cadenceCron, sql),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY });
    },
  });

  return {
    createJob: (name, cadenceCron, sql) => mutation.mutateAsync({ name, cadenceCron, sql }),
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
