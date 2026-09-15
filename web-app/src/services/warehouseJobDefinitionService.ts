import { fetchAuthSession } from "aws-amplify/auth";
import { config } from "../config";
import {
  WarehouseJobDefinitionSchema,
  WarehouseJobDefinitionListResponseSchema,
  WAREHOUSE_JOB_NAME_REGEX,
  type WarehouseJobDefinition,
} from "../models/warehouseJobDefinition";
import { WarehouseJobSqlResponseSchema } from "../models/warehouseJobSql";
import { MOCK_WAREHOUSE_JOB_DEFINITIONS } from "../test-data/warehouseJobDefinitions";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — same shape as capacityService. Backs the admin
 * warehouse workspace (7-data-warehousing.md §12b, Leg 8): create/
 * update/delete/list a self-service warehouse job, plus reading a job's
 * SQL back out for the "load into the query editor" flow.
 */
export interface WarehouseJobDefinitionService {
  listJobs(): Promise<WarehouseJobDefinition[]>;
  createJob(name: string, cadenceCron: string, sql: string): Promise<WarehouseJobDefinition>;
  updateJob(name: string, cadenceCron: string, sql: string): Promise<WarehouseJobDefinition>;
  deleteJob(name: string): Promise<void>;
  getJobSql(name: string): Promise<string>;
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) {
    throw new Error("Not authenticated");
  }
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
}

async function errorMessageFrom(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? `${fallback}: HTTP ${response.status}`;
}

class LiveWarehouseJobDefinitionService implements WarehouseJobDefinitionService {
  async listJobs(): Promise<WarehouseJobDefinition[]> {
    const response = await authorizedFetch("/admin/warehouse/jobs");
    if (!response.ok) {
      throw new Error(await errorMessageFrom(response, "Failed to list jobs"));
    }
    const body: unknown = await response.json();
    return WarehouseJobDefinitionListResponseSchema.parse(body).jobs;
  }

  async createJob(name: string, cadenceCron: string, sql: string): Promise<WarehouseJobDefinition> {
    const response = await authorizedFetch("/admin/warehouse/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cadence_cron: cadenceCron, sql }),
    });
    if (!response.ok) {
      throw new Error(await errorMessageFrom(response, "Failed to create job"));
    }
    const body: unknown = await response.json();
    return WarehouseJobDefinitionSchema.parse(body);
  }

  async updateJob(name: string, cadenceCron: string, sql: string): Promise<WarehouseJobDefinition> {
    const response = await authorizedFetch(`/admin/warehouse/jobs/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cadence_cron: cadenceCron, sql }),
    });
    if (!response.ok) {
      throw new Error(await errorMessageFrom(response, "Failed to update job"));
    }
    const body: unknown = await response.json();
    return WarehouseJobDefinitionSchema.parse(body);
  }

  async deleteJob(name: string): Promise<void> {
    const response = await authorizedFetch(`/admin/warehouse/jobs/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await errorMessageFrom(response, "Failed to delete job"));
    }
  }

  async getJobSql(name: string): Promise<string> {
    const response = await authorizedFetch(`/admin/warehouse/jobs/${encodeURIComponent(name)}/sql`);
    if (!response.ok) {
      throw new Error(await errorMessageFrom(response, "Failed to load job SQL"));
    }
    const body: unknown = await response.json();
    return WarehouseJobSqlResponseSchema.parse(body).sql;
  }
}

/*
 * Generates data on the fly for write operations, per CLAUDE.md §5.1's
 * in-memory-mode contract — same module-scope-mutable-state shape as
 * MockCapacityService. Mock mode has no real S3/Scheduler to write to, so
 * create/update/delete only ever touch this array (and, for SQL text —
 * never part of the real GET /admin/warehouse/jobs response — the
 * `mockJobSql` map below).
 */
let mockJobs: WarehouseJobDefinition[] = MOCK_WAREHOUSE_JOB_DEFINITIONS.jobs.map((job) => ({ ...job }));

/** Placeholder SQL for a job that has never been created/updated in this mock session. */
function placeholderSql(name: string): string {
  return `-- mock placeholder: no S3-backed SQL yet for "${name}"\nSELECT 1`;
}

const mockJobSql: Record<string, string> = {};

class MockWarehouseJobDefinitionService implements WarehouseJobDefinitionService {
  async listJobs(): Promise<WarehouseJobDefinition[]> {
    return mockJobs;
  }

  async createJob(name: string, cadenceCron: string, sql: string): Promise<WarehouseJobDefinition> {
    if (!WAREHOUSE_JOB_NAME_REGEX.test(name)) {
      throw new Error("Job name must be lowercase letters, digits, and underscores only");
    }
    if (mockJobs.some((job) => job.job_name === name)) {
      throw new Error(`A job named "${name}" already exists`);
    }
    if (sql.trim() === "") {
      throw new Error("SQL is required");
    }
    const job: WarehouseJobDefinition = {
      job_run_id: `DEF#${name}`,
      record_type: "DEFINITION",
      job_name: name,
      sql_s3_key: `job-definitions/${name}.sql`,
      cadence_cron: cadenceCron,
      schedule_name: `Nyc311WarehouseJob-${name}-Mock`,
      created_at: new Date().toISOString(),
      created_by: "01MOCKADMIN0000000000000001",
    };
    mockJobs = [job, ...mockJobs];
    mockJobSql[name] = sql;
    return job;
  }

  async updateJob(name: string, cadenceCron: string, sql: string): Promise<WarehouseJobDefinition> {
    const existing = mockJobs.find((job) => job.job_name === name);
    if (!existing) {
      throw new Error(`No job named "${name}"`);
    }
    if (sql.trim() === "") {
      throw new Error("SQL is required");
    }
    const updated: WarehouseJobDefinition = { ...existing, cadence_cron: cadenceCron };
    mockJobs = mockJobs.map((job) => (job.job_name === name ? updated : job));
    mockJobSql[name] = sql;
    return updated;
  }

  async deleteJob(name: string): Promise<void> {
    if (!mockJobs.some((job) => job.job_name === name)) {
      throw new Error(`No job named "${name}"`);
    }
    mockJobs = mockJobs.filter((job) => job.job_name !== name);
  }

  async getJobSql(name: string): Promise<string> {
    if (!mockJobs.some((job) => job.job_name === name)) {
      throw new Error(`No job named "${name}"`);
    }
    return mockJobSql[name] ?? placeholderSql(name);
  }
}

export const warehouseJobDefinitionService: WarehouseJobDefinitionService =
  config.dataMode === "live" ? new LiveWarehouseJobDefinitionService() : new MockWarehouseJobDefinitionService();
