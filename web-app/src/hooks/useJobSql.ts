import { useMutation } from "@tanstack/react-query";
import { warehouseJobDefinitionService } from "../services/warehouseJobDefinitionService";

export interface UseJobSqlResult {
  loadSql: (name: string) => Promise<string>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * the Jobs panel's "Load" action (`7-data-warehousing.md` §12b's "load a
 * job into the query editor" flow) — an on-demand fetch triggered by a
 * click, not data a page needs as soon as it renders, so this is a
 * mutation (like {@link useWarehouseQuery}'s `runQuery`), not a query.
 */
export function useJobSql(): UseJobSqlResult {
  const mutation = useMutation<string, Error, string>({
    mutationFn: (name) => warehouseJobDefinitionService.getJobSql(name),
  });

  return {
    loadSql: (name) => mutation.mutateAsync(name),
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
