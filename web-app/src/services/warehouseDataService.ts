import { config } from "../config";
import { WarehouseSchemaResponseSchema, type WarehouseSchemaResponse } from "../models/warehouseSchema";
import { WarehouseJobRunListResponseSchema, type WarehouseJobRunListResponse } from "../models/warehouseJobRun";
import { AnalyticsRollupListResponseSchema, type AnalyticsRollupListResponse } from "../models/analyticsRollup";
import { MOCK_WAREHOUSE_SCHEMA } from "../test-data/warehouseSchema";
import { MOCK_WAREHOUSE_JOB_RUNS } from "../test-data/warehouseJobRuns";
import { MOCK_ANALYTICS_ROLLUPS } from "../test-data/analyticsRollups";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as pipelineStatusService.ts. Backs
 * GET /data/schema, GET /data/jobs and GET /data/rollups
 * (7-data-warehousing.md §12).
 */
export interface WarehouseDataService {
  getSchema(): Promise<WarehouseSchemaResponse>;
  getJobRuns(): Promise<WarehouseJobRunListResponse>;
  getRollups(): Promise<AnalyticsRollupListResponse>;
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

  async getRollups(): Promise<AnalyticsRollupListResponse> {
    const response = await fetch(`${config.apiBaseUrl}/data/rollups`);
    if (!response.ok) {
      throw new Error(`Failed to fetch analytics rollups: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return AnalyticsRollupListResponseSchema.parse(body);
  }
}

class MockWarehouseDataService implements WarehouseDataService {
  async getSchema(): Promise<WarehouseSchemaResponse> {
    return MOCK_WAREHOUSE_SCHEMA;
  }

  async getJobRuns(): Promise<WarehouseJobRunListResponse> {
    return MOCK_WAREHOUSE_JOB_RUNS;
  }

  async getRollups(): Promise<AnalyticsRollupListResponse> {
    return MOCK_ANALYTICS_ROLLUPS;
  }
}

export const warehouseDataService: WarehouseDataService =
  config.dataMode === "live" ? new LiveWarehouseDataService() : new MockWarehouseDataService();
