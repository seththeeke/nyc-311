import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import { ValidationError } from "../../../models/errors";
import type { WebhookCustomerFacingOrder } from "../../../models/webhookCustomerFacingOrder";
import { openOrder } from "../../fixtures";

const TABLE_NAME = "WebhookCustomerFacingOrders-Prod";
const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new WebhookCustomerFacingOrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE_NAME);
const closedOrder: WebhookCustomerFacingOrder = { ...openOrder, status: "CLOSED", resolved_at: "2026-10-11T09:27:40.000Z" };

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WebhookCustomerFacingOrderDao.getOrder", () => {
  it("returns the validated row or null, and fails loudly on a corrupt row", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: openOrder }).resolvesOnce({}).resolvesOnce({ Item: { order_id: "BAD" } });
    await expect(dao.getOrder("01ORDER")).resolves.toEqual(openOrder);
    await expect(dao.getOrder("MISSING")).resolves.toBeNull();
    await expect(dao.getOrder("BAD")).rejects.toBeInstanceOf(ValidationError);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input).toEqual({ TableName: TABLE_NAME, Key: { order_id: "01ORDER" } });
  });
});

describe("WebhookCustomerFacingOrderDao.openOrder", () => {
  it("creates the row only if absent, and reports true", async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(dao.openOrder(openOrder)).resolves.toBe(true);
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input.ConditionExpression).toBe("attribute_not_exists(order_id)");
    expect(input.Item).toEqual(openOrder);
  });

  it("reports false, without throwing, when the order is already known", async () => {
    ddbMock.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: "exists", $metadata: {} }));
    await expect(dao.openOrder(openOrder)).resolves.toBe(false);
  });

  it("rethrows any other failure, and never writes an invalid row", async () => {
    ddbMock.on(PutCommand).rejects(new Error("throttled"));
    await expect(dao.openOrder(openOrder)).rejects.toThrow("throttled");
    ddbMock.resetHistory();
    await expect(dao.openOrder({ ...openOrder, order_id: "" })).rejects.toBeInstanceOf(ValidationError);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});

describe("WebhookCustomerFacingOrderDao.closeOrder", () => {
  it("writes unconditionally, so a repeat or a missing accept is harmless", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.closeOrder(closedOrder);
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input.ConditionExpression).toBeUndefined();
    expect(input.Item).toEqual(closedOrder);
  });
});

describe("WebhookCustomerFacingOrderDao sampling reads", () => {
  it("reads from the pick key onward and stops once it has enough", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [openOrder, openOrder] });
    await expect(dao.sampleOpenOrders("BROOKLYN", "8f", 2)).resolves.toHaveLength(2);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toMatchObject({ IndexName: "OpenByBorough", ExpressionAttributeValues: { ":borough": "BROOKLYN", ":pick": "8f" }, Limit: 2 });
  });

  it("wraps to the start of the index when the read runs off the end", async () => {
    ddbMock.on(QueryCommand).resolvesOnce({ Items: [openOrder] }).resolvesOnce({});
    await expect(dao.sampleOpenOrders("BRONX", "ff", 3)).resolves.toHaveLength(1);
    const second = ddbMock.commandCalls(QueryCommand)[1].args[0].input;
    expect(second.KeyConditionExpression).toContain("pick_key < :pick");
    expect(second.Limit).toBe(2);
  });

  it("batch-gets distinct ids in chunks of 100, retrying unprocessed keys once", async () => {
    ddbMock
      .on(BatchGetCommand)
      .resolvesOnce({ Responses: { [TABLE_NAME]: [openOrder] }, UnprocessedKeys: { [TABLE_NAME]: { Keys: [{ order_id: "B" }] } } })
      .resolvesOnce({ Responses: { [TABLE_NAME]: [closedOrder] } })
      .resolves({});
    const ids = ["A", "A", "B", ...Array.from({ length: 100 }, (_, i) => `X${i}`)];
    await expect(dao.batchGetOrders(ids)).resolves.toEqual([openOrder, closedOrder]);
    expect(ddbMock.commandCalls(BatchGetCommand)).toHaveLength(3);
    await expect(dao.batchGetOrders([])).resolves.toEqual([]);
  });
});
