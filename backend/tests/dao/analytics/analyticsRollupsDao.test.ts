import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsRollupsDao } from "../../../dao/analytics/analyticsRollupsDao";
import type { AnalyticsRollup } from "../../../models/analyticsRollup";

const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new AnalyticsRollupsDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), "AnalyticsRollups-Test");

const rollup: AnalyticsRollup = {
  metric_view: "ORDER_VOLUME_BY_STAGE",
  rollup_key: "2026-09-06#SCHEDULE",
  run_date: "2026-09-06",
  dimension: "SCHEDULE",
  value: 42,
  computed_at: "2026-09-06T09:00:12.000Z",
  job_run_id: "01RUN",
};

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnalyticsRollupsDao", () => {
  it("putRollup writes the full row", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putRollup(rollup);
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.Item).toMatchObject(rollup);
  });

  it("listRollups queries the base table by metric_view, newest rollup_key first", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [rollup] });
    const rows = await dao.listRollups("ORDER_VOLUME_BY_STAGE", 100);

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input).toMatchObject({
      KeyConditionExpression: "metric_view = :mv",
      ExpressionAttributeValues: { ":mv": "ORDER_VOLUME_BY_STAGE" },
      ScanIndexForward: false,
      Limit: 100,
    });
    expect(rows).toEqual([rollup]);
  });

  it("listRollups returns [] when the view has no rows yet", async () => {
    ddbMock.on(QueryCommand).resolves({});
    expect(await dao.listRollups("ORDER_VOLUME_BY_STAGE", 10)).toEqual([]);
  });
});
