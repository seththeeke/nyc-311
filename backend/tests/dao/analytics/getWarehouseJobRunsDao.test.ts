import { afterEach, describe, expect, it, vi } from "vitest";
import { WarehouseJobRunsDao } from "../../../dao/analytics/warehouseJobRunsDao";
import { getWarehouseJobRunsDao } from "../../../dao/analytics/getWarehouseJobRunsDao";

describe("getWarehouseJobRunsDao", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a new WarehouseJobRunsDao on every call", () => {
    vi.stubEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME", "WarehouseJobRuns-Test");
    const dao = getWarehouseJobRunsDao();
    expect(dao).toBeInstanceOf(WarehouseJobRunsDao);
    expect(getWarehouseJobRunsDao()).not.toBe(dao);
  });

  it("throws when WAREHOUSE_JOB_RUNS_TABLE_NAME is missing", () => {
    vi.stubEnv("WAREHOUSE_JOB_RUNS_TABLE_NAME", "");
    expect(() => getWarehouseJobRunsDao()).toThrow("WAREHOUSE_JOB_RUNS_TABLE_NAME");
  });
});
