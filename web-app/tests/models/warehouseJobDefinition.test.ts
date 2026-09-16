import { describe, expect, it } from "vitest";
import {
  WarehouseJobDefinitionSchema,
  WarehouseJobDefinitionListResponseSchema,
  WAREHOUSE_JOB_NAME_REGEX,
} from "../../src/models/warehouseJobDefinition";

const validDefinition = {
  job_run_id: "DEF#order_volume_by_zip",
  record_type: "DEFINITION" as const,
  job_name: "order_volume_by_zip",
  sql_s3_key: "job-definitions/order_volume_by_zip.sql",
  job_type: "SCHEDULED" as const,
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

describe("WAREHOUSE_JOB_NAME_REGEX", () => {
  it("accepts lowercase letters, digits, and underscores", () => {
    expect(WAREHOUSE_JOB_NAME_REGEX.test("order_volume_by_zip_2")).toBe(true);
  });

  it("rejects uppercase letters", () => {
    expect(WAREHOUSE_JOB_NAME_REGEX.test("OrderVolume")).toBe(false);
  });

  it("rejects spaces and hyphens", () => {
    expect(WAREHOUSE_JOB_NAME_REGEX.test("order-volume by zip")).toBe(false);
  });
});

describe("WarehouseJobDefinitionSchema", () => {
  it("accepts a well-formed definition", () => {
    expect(WarehouseJobDefinitionSchema.parse(validDefinition)).toEqual(validDefinition);
  });

  it("rejects a job_name that doesn't match the naming regex", () => {
    expect(WarehouseJobDefinitionSchema.safeParse({ ...validDefinition, job_name: "Order Volume" }).success).toBe(false);
  });

  it("rejects a record_type other than DEFINITION", () => {
    expect(WarehouseJobDefinitionSchema.safeParse({ ...validDefinition, record_type: "RUN" }).success).toBe(false);
  });

  it("defaults job_type to SCHEDULED when absent", () => {
    const { job_type: _jobType, ...rest } = validDefinition;
    void _jobType;
    expect(WarehouseJobDefinitionSchema.parse(rest).job_type).toBe("SCHEDULED");
  });

  it("accepts a SAVED_QUERY definition with no cadence_cron/schedule_name", () => {
    const { cadence_cron: _cadenceCron, schedule_name: _scheduleName, ...rest } = validDefinition;
    void _cadenceCron;
    void _scheduleName;
    const savedQuery = { ...rest, job_type: "SAVED_QUERY" as const };
    expect(WarehouseJobDefinitionSchema.parse(savedQuery)).toEqual(savedQuery);
  });
});

describe("WarehouseJobDefinitionListResponseSchema", () => {
  it("accepts a list of definitions", () => {
    const response = { jobs: [validDefinition] };
    expect(WarehouseJobDefinitionListResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty list", () => {
    expect(WarehouseJobDefinitionListResponseSchema.parse({ jobs: [] })).toEqual({ jobs: [] });
  });

  it("rejects a response missing jobs", () => {
    expect(WarehouseJobDefinitionListResponseSchema.safeParse({}).success).toBe(false);
  });
});
