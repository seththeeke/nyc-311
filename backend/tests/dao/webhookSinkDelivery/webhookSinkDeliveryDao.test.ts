import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookSinkDeliveryDao } from "../../../dao/webhookSinkDelivery/webhookSinkDeliveryDao";
import type { WebhookSinkDelivery } from "../../../models/webhookSinkDelivery";

const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new WebhookSinkDeliveryDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), "WebhookSinkDeliveries");

const delivery: WebhookSinkDelivery = {
  webhook_id: "evt_01ORDER_1",
  event_type: "ORDER_ACCEPTED",
  received_at: "2026-10-10T14:03:12.000Z",
  signature_valid: true,
  expires_at: 1791000000,
};

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WebhookSinkDeliveryDao", () => {
  it("puts a delivery with no condition, so a redelivery overwrites", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.putDelivery(delivery);
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input.Item).toEqual(delivery);
    expect(input.ConditionExpression).toBeUndefined();
  });

  it("scans every page, and handles an empty table", async () => {
    const other = { ...delivery, webhook_id: "evt_01ORDER_6" };
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [delivery], LastEvaluatedKey: { webhook_id: "evt_01ORDER_1" } })
      .resolvesOnce({ Items: [other] })
      .resolvesOnce({});
    await expect(dao.listDeliveries()).resolves.toEqual([delivery, other]);
    await expect(dao.listDeliveries()).resolves.toEqual([]);
  });
});
