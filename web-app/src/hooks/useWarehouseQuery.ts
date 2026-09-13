import { useMutation } from "@tanstack/react-query";
import { warehouseQueryService } from "../services/warehouseQueryService";
import type { AdHocQueryResult } from "../models/adHocQueryResult";

export interface UseWarehouseQueryResult {
  runQuery: (sql: string) => Promise<AdHocQueryResult>;
  result: AdHocQueryResult | undefined;
  isRunning: boolean;
  error: Error | null;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * `SqlQueryConsole` (`7-data-warehousing.md` §12a, Leg 7) — a mutation, not
 * a poll, same shape as `useScheduling`, but returns the resultset instead
 * of a void success signal.
 */
export function useWarehouseQuery(): UseWarehouseQueryResult {
  const mutation = useMutation<AdHocQueryResult, Error, string>({
    mutationFn: (sql: string) => warehouseQueryService.runQuery(sql),
  });

  return {
    runQuery: (sql: string) => mutation.mutateAsync(sql),
    result: mutation.data,
    isRunning: mutation.isPending,
    error: mutation.error,
  };
}
