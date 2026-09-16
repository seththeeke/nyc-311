import { describe, expect, it } from "vitest";
import {
  CreateWarehouseJobRequestSchema,
  UpdateWarehouseJobRequestSchema,
  WarehouseJobNameParamsSchema,
} from "../../models/warehouseJobRequest";

describe("CreateWarehouseJobRequestSchema", () => {
  const valid = {
    name: "order_volume_by_zip",
    job_type: "SCHEDULED" as const,
    cadence_cron: "cron(0 9 * * ? *)",
    sql: "SELECT 1",
  };

  it("accepts a well-formed SCHEDULED request", () => {
    expect(CreateWarehouseJobRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a name that isn't lower_snake_case", () => {
    for (const name of ["Order-Zip", "order zip", ""]) {
      expect(CreateWarehouseJobRequestSchema.safeParse({ ...valid, name }).success).toBe(false);
    }
  });

  it("rejects an empty cadence_cron or sql", () => {
    expect(CreateWarehouseJobRequestSchema.safeParse({ ...valid, cadence_cron: "" }).success).toBe(false);
    expect(CreateWarehouseJobRequestSchema.safeParse({ ...valid, sql: "" }).success).toBe(false);
  });

  it("rejects a SCHEDULED request with no cadence_cron", () => {
    const { cadence_cron: _cadenceCron, ...rest } = valid;
    void _cadenceCron;
    expect(CreateWarehouseJobRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts a SAVED_QUERY request with no cadence_cron", () => {
    const { cadence_cron: _cadenceCron, ...rest } = valid;
    void _cadenceCron;
    const savedQuery = { ...rest, job_type: "SAVED_QUERY" as const };
    expect(CreateWarehouseJobRequestSchema.parse(savedQuery)).toEqual(savedQuery);
  });

  it("rejects an unrecognized job_type", () => {
    expect(CreateWarehouseJobRequestSchema.safeParse({ ...valid, job_type: "WEEKLY" }).success).toBe(false);
  });
});

describe("WarehouseJobNameParamsSchema", () => {
  it("accepts a name", () => {
    expect(WarehouseJobNameParamsSchema.parse({ name: "order_volume_by_zip" })).toEqual({
      name: "order_volume_by_zip",
    });
  });

  it("rejects a missing name", () => {
    expect(WarehouseJobNameParamsSchema.safeParse({}).success).toBe(false);
  });
});

describe("UpdateWarehouseJobRequestSchema", () => {
  const valid = { cadence_cron: "cron(0 9 * * ? *)", sql: "SELECT 1" };

  it("accepts a well-formed request", () => {
    expect(UpdateWarehouseJobRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects an empty cadence_cron or sql", () => {
    expect(UpdateWarehouseJobRequestSchema.safeParse({ ...valid, cadence_cron: "" }).success).toBe(false);
    expect(UpdateWarehouseJobRequestSchema.safeParse({ ...valid, sql: "" }).success).toBe(false);
  });

  it("accepts a request with no cadence_cron (a SAVED_QUERY update)", () => {
    const { cadence_cron: _cadenceCron, ...rest } = valid;
    void _cadenceCron;
    expect(UpdateWarehouseJobRequestSchema.parse(rest)).toEqual(rest);
  });
});
