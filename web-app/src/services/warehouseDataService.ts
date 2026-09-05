import { config } from "../config";
import { WarehouseSchemaResponseSchema, type WarehouseSchemaResponse } from "../models/warehouseSchema";
import { WarehouseJobRunListResponseSchema, type WarehouseJobRunListResponse } from "../models/warehouseJobRun";
import { MOCK_WAREHOUSE_SCHEMA } from "../test-data/warehouseSchema";
import { MOCK_WAREHOUSE_JOB_RUNS } from "../test-data/warehouseJobRuns";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as pipelineStatusService.ts. Backs
 * GET /data/schema and GET /data/jobs (7-data-warehousing.md §12); this
 * frontend build is mock-only for now — the live branch is the documented
 * contract the backend hooks into once it exists, not yet exercised
 * against a real deploy.
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
    const response = await fetch(`${config.apiBaseUrl}/data/jobs`);
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

/*
 * Hardcoded to mock, unlike every other service here — GET /data/schema
 * and GET /data/jobs don't exist yet (backend/cdk stay untouched per this
 * build's scope). LiveWarehouseDataService is the documented target
 * contract; restore the usual `config.dataMode === "live" ? ... : ...`
 * selection once that backend ships.
 */
export const warehouseDataService: WarehouseDataService = new MockWarehouseDataService();
