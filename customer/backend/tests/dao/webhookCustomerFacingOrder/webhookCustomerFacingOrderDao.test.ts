import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
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
