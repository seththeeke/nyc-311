import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { warehouseJobDefinitionService } from "../services/warehouseJobDefinitionService";
import type { WarehouseJobDefinition } from "../models/warehouseJobDefinition";

export const WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY = ["warehouseJobDefinitions"] as const;

/** Components call hooks, never services, directly (CLAUDE.md §5.1). Backs the admin Jobs tab (7-data-warehousing.md §12b, Leg 8). */
export function useWarehouseJobDefinitions(): UseQueryResult<WarehouseJobDefinition[], Error> {
  return useQuery({
    queryKey: WAREHOUSE_JOB_DEFINITIONS_QUERY_KEY,
    queryFn: () => warehouseJobDefinitionService.listJobs(),
  });
}
