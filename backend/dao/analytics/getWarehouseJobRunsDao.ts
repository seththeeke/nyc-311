import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { WarehouseJobRunsDao } from "./warehouseJobRunsDao";

/**
 * Builds a fresh `WarehouseJobRunsDao` on every call, reading
 * `WAREHOUSE_JOB_RUNS_TABLE_NAME` only then: the one place that names this
 * table's env var (§5.2: lazy, never module scope).
 */
export function getWarehouseJobRunsDao(): WarehouseJobRunsDao {
  return new WarehouseJobRunsDao(createDocumentClient(), requireEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME"));
}
