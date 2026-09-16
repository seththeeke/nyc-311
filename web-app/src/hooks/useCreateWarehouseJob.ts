import { useMutation, useQueryClient } from "@tanstack/react-query";
import { warehouseJobDefinitionService } from "../services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../models/warehouseJobDefinition";
import { WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY } from "./useWarehouseJobDefinitions";

export interface UseCreateWarehouseJobResult {
  /** `cadenceCron` omitted creates a saved query (no schedule); passing one creates a scheduled job. */
  createJob: (name: string, sql: string, cadenceCron?: string) => Promise<WarehouseJobDefinition>;
  isCreating: boolean;
  error: Error | null;
}

interface CreateWarehouseJobInput {
  name: string;
  sql: string;
  cadenceCron?: string;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * the Jobs panel's "New job" form and the query console's "Save as job"/
 * "Save as query" controls (7-data-warehousing.md §12b, Leg 8). Invalidates
 * the job definition list on success so a newly created job/query appears
 * immediately.
 */
export function useCreateWarehouseJob(): UseCreateWarehouseJobResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<WarehouseJobDefinition, Error, CreateWarehouseJobInput>({
    mutationFn: ({ name, sql, cadenceCron }) => warehouseJobDefinitionService.createJob(name, sql, cadenceCron),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY });
    },
  });

  return {
    createJob: (name, sql, cadenceCron) => mutation.mutateAsync({ name, sql, cadenceCron }),
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
