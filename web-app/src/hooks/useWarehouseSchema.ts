import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { warehouseDataService } from "../services/warehouseDataService";
import type { WarehouseSchemaResponse } from "../models/warehouseSchema";

export const WAREHOUSE_SCHEMA_QUERY_KEY = ["warehouseSchema"] as const;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). */
export function useWarehouseSchema(): UseQueryResult<WarehouseSchemaResponse, Error> {
  return useQuery({
    queryKey: WAREHOUSE_SCHEMA_QUERY_KEY,
    queryFn: () => warehouseDataService.getSchema(),
  });
}
