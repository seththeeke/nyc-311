import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listRollups, SAMPLE_METRIC_VIEW } from "../../../service/analytics/analyticsRollupsService";
import type { AnalyticsRollupsDao } from "../../../dao/analytics/analyticsRollupsDao";

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listRollups", () => {
  it("queries the DAO for the sample metric_view by default and wraps in { rollups }", async () => {
    const rollup = {
      metric_view: SAMPLE_METRIC_VIEW,
      rollup_key: "2026-09-06#INGEST",
      run_date: "2026-09-06",
      dimension: "INGEST",
      value: 3,
      computed_at: "2026-09-06T09:00:00.000Z",
      job_run_id: "01RUN",
    };
    const dao = { listRollups: vi.fn().mockResolvedValue([rollup]) } as unknown as AnalyticsRollupsDao;

    const result = await listRollups({ rollupsDao: dao });

    expect(dao.listRollups).toHaveBeenCalledWith(SAMPLE_METRIC_VIEW, 200);
    expect(result.rollups).toEqual([rollup]);
  });

  it("honors an explicit metricView / limit", async () => {
    const dao = { listRollups: vi.fn().mockResolvedValue([]) } as unknown as AnalyticsRollupsDao;

    await listRollups({ rollupsDao: dao, metricView: "OTHER", limit: 10 });

    expect(dao.listRollups).toHaveBeenCalledWith("OTHER", 10);
  });

  it("constructs a default DAO from ANALYTICS_ROLLUPS_TABLE_NAME when none is injected", async () => {
    const prev = process.env["ANALYTICS_ROLLUPS_TABLE_NAME"];
    process.env["ANALYTICS_ROLLUPS_TABLE_NAME"] = "AnalyticsRollups-Test";
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    try {
      const result = await listRollups();
      expect(result.rollups).toEqual([]);
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
    } finally {
      if (prev === undefined) delete process.env["ANALYTICS_ROLLUPS_TABLE_NAME"];
      else process.env["ANALYTICS_ROLLUPS_TABLE_NAME"] = prev;
    }
  });

  it("throws when ANALYTICS_ROLLUPS_TABLE_NAME is unset and no DAO is injected", async () => {
    const prev = process.env["ANALYTICS_ROLLUPS_TABLE_NAME"];
    delete process.env["ANALYTICS_ROLLUPS_TABLE_NAME"];
    try {
      await expect(listRollups()).rejects.toThrow("ANALYTICS_ROLLUPS_TABLE_NAME");
    } finally {
      if (prev !== undefined) process.env["ANALYTICS_ROLLUPS_TABLE_NAME"] = prev;
    }
  });
});
