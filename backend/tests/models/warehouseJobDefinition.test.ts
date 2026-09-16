import { describe, expect, it } from "vitest";
import {
  DEFINITIONS_GSI1_PK,
  WarehouseJobDefinitionSchema,
  warehouseJobDefinitionId,
} from "../../models/warehouseJobDefinition";

const valid = {
  job_run_id: "DEF#order_volume_by_borough",
  record_type: "DEFINITION" as const,
  job_name: "order_volume_by_borough",
  sql_s3_key: "job-definitions/order_volume_by_borough.sql",
  job_type: "SCHEDULED" as const,
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_borough-Test",
  created_at: "2026-09-13T00:00:00.000Z",
  created_by: "01ADMIN",
};

const REQUIRED_KEYS = ["job_run_id", "record_type", "job_name", "sql_s3_key", "created_at", "created_by"] as const;

describe("WarehouseJobDefinitionSchema", () => {
  it("accepts a well-formed definition", () => {
    expect(WarehouseJobDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it("rejects record_type other than DEFINITION", () => {
    expect(WarehouseJobDefinitionSchema.safeParse({ ...valid, record_type: "RUN" }).success).toBe(false);
  });

  it("rejects a job_name that isn't lower_snake_case", () => {
    for (const job_name of ["Order-Volume", "order volume", ""]) {
      expect(WarehouseJobDefinitionSchema.safeParse({ ...valid, job_name }).success).toBe(false);
    }
  });

  it("rejects a missing required field", () => {
    for (const key of REQUIRED_KEYS) {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[key];
      expect(WarehouseJobDefinitionSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("defaults job_type to SCHEDULED when absent (rows created before job_type existed)", () => {
    const { job_type: _jobType, ...withoutJobType } = valid;
    void _jobType;
    expect(WarehouseJobDefinitionSchema.parse(withoutJobType).job_type).toBe("SCHEDULED");
  });

  it("accepts a SAVED_QUERY definition with no cadence_cron/schedule_name", () => {
    const { cadence_cron: _cadenceCron, schedule_name: _scheduleName, ...rest } = valid;
    void _cadenceCron;
    void _scheduleName;
    const savedQuery = { ...rest, job_type: "SAVED_QUERY" as const };
    const parsed = WarehouseJobDefinitionSchema.parse(savedQuery);
    expect(parsed.job_type).toBe("SAVED_QUERY");
    expect(parsed.cadence_cron).toBeUndefined();
    expect(parsed.schedule_name).toBeUndefined();
  });

  it("rejects an unrecognized job_type", () => {
    expect(WarehouseJobDefinitionSchema.safeParse({ ...valid, job_type: "WEEKLY" }).success).toBe(false);
  });
});

describe("warehouseJobDefinitionId", () => {
  it("prefixes the name with DEF#", () => {
    expect(warehouseJobDefinitionId("order_volume_by_borough")).toBe("DEF#order_volume_by_borough");
  });
});

describe("DEFINITIONS_GSI1_PK", () => {
  it("is a fixed, distinct partition value from runs' JOB#RUNS", () => {
    expect(DEFINITIONS_GSI1_PK).toBe("JOB#DEFINITIONS");
  });
});
