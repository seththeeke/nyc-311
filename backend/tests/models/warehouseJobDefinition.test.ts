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
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_borough-Test",
  created_at: "2026-09-13T00:00:00.000Z",
  created_by: "01ADMIN",
};

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
    for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[key];
      expect(WarehouseJobDefinitionSchema.safeParse(rest).success).toBe(false);
    }
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
