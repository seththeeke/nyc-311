import { config } from "../config";
import { WarehouseSchemaResponseSchema, type WarehouseSchemaResponse } from "../models/warehouseSchema";
import { WarehouseJobRunListResponseSchema, type WarehouseJobRunListResponse } from "../models/warehouseJobRun";
import { MOCK_WAREHOUSE_SCHEMA } from "../test-data/warehouseSchema";
import { MOCK_WAREHOUSE_JOB_RUNS } from "../test-data/warehouseJobRuns";
import { authorizedFetch } from "./http";

/*
 * One interface, two implementations, selected by VITE_DATA_MODE at build time
 * (CLAUDE.md §5.1) — same shape as pipelineStatusService.ts. Backs
 * public GET /data/schema and admin GET /admin/warehouse/job-runs, which
 * replaced public GET /data/jobs (15-resource-consolidation.md §3.3).
 */
export interface WarehouseDataService {
  getSchema(): Promise<WarehouseSchemaResponse>;
  getJobRuns(): Promise<WarehouseJobRunListResponse>;
}

export class LiveWarehouseDataService implements WarehouseDataService {
  async getSchema(): Promise<WarehouseSchemaResponse> {
    const response = await fetch(`${config.apiBaseUrl}/data/schema`);
    if (!response.ok) {
      throw new Error(`Failed to fetch warehouse schema: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return WarehouseSchemaResponseSchema.parse(body);
  }

  async getJobRuns(): Promise<WarehouseJobRunListResponse> {
    const response = await authorizedFetch("/admin/warehouse/job-runs");
    if (!response.ok) {
      throw new Error(`Failed to fetch warehouse job runs: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return WarehouseJobRunListResponseSchema.parse(body);
  }

}

class MockWarehouseDataService implements WarehouseDataService {
  async getSchema(): Promise<WarehouseSchemaResponse> {
    return MOCK_WAREHOUSE_SCHEMA;
  }

  async getJobRuns(): Promise<WarehouseJobRunListResponse> {
    return MOCK_WAREHOUSE_JOB_RUNS;
  }

}

export const warehouseDataService: WarehouseDataService =
  import.meta.env.VITE_DATA_MODE === "live" ? new LiveWarehouseDataService() : new MockWarehouseDataService();
