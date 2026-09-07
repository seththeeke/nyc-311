import { config } from "../config";
import { WarehouseSchemaResponseSchema, type WarehouseSchemaResponse } from "../models/warehouseSchema";
import { WarehouseJobRunListResponseSchema, type WarehouseJobRunListResponse } from "../models/warehouseJobRun";
import { JobResultSchema, type JobResult } from "../models/jobResult";
import { MOCK_WAREHOUSE_SCHEMA } from "../test-data/warehouseSchema";
import { MOCK_WAREHOUSE_JOB_RUNS } from "../test-data/warehouseJobRuns";
import { MOCK_JOB_RESULTS } from "../test-data/jobResult";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as pipelineStatusService.ts. Backs
 * GET /data/schema, GET /data/jobs and GET /data/jobs/{name}/result
 * (7-data-warehousing.md §11/§12).
 */
export interface WarehouseDataService {
  getSchema(): Promise<WarehouseSchemaResponse>;
  getJobRuns(): Promise<WarehouseJobRunListResponse>;
  getJobResult(jobName: string): Promise<JobResult>;
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

  async getJobResult(jobName: string): Promise<JobResult> {
    const response = await fetch(`${config.apiBaseUrl}/data/jobs/${encodeURIComponent(jobName)}/result`);
    if (!response.ok) {
      throw new Error(`Failed to fetch result for '${jobName}': HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return JobResultSchema.parse(body);
  }
}

class MockWarehouseDataService implements WarehouseDataService {
  async getSchema(): Promise<WarehouseSchemaResponse> {
    return MOCK_WAREHOUSE_SCHEMA;
  }

  async getJobRuns(): Promise<WarehouseJobRunListResponse> {
    return MOCK_WAREHOUSE_JOB_RUNS;
  }

  async getJobResult(jobName: string): Promise<JobResult> {
    const result = MOCK_JOB_RESULTS[jobName];
    if (!result) {
      throw new Error(`Failed to fetch result for '${jobName}': HTTP 404`);
    }
    return result;
  }
}

export const warehouseDataService: WarehouseDataService =
  config.dataMode === "live" ? new LiveWarehouseDataService() : new MockWarehouseDataService();
