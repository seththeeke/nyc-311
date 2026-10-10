import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookSubscriptionDao } from "../../../dao/webhookSubscription/webhookSubscriptionDao";
import { TerminalError, ValidationError } from "../../../models/errors";
import { subscription } from "../../service/webhook/webhookTestFixtures";

const TABLE_NAME = "WebhookSubscriptions";
const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new WebhookSubscriptionDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE_NAME);

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WebhookSubscriptionDao.getSubscription", () => {
  it("returns the validated row or null", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: subscription }).resolvesOnce({});
    await expect(dao.getSubscription("01SUB")).resolves.toEqual(subscription);
    await expect(dao.getSubscription("MISSING")).resolves.toBeNull();
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ subscription_id: "01SUB" });
  });
});

describe("WebhookSubscriptionDao.listSubscriptions", () => {
  it("scans every page with a strongly consistent read", async () => {
    const other = { ...subscription, subscription_id: "02SUB" };
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [subscription], LastEvaluatedKey: { subscription_id: "01SUB" } })
      .resolvesOnce({ Items: [other] });
    await expect(dao.listSubscriptions()).resolves.toEqual([subscription, other]);
    const calls = ddbMock.commandCalls(ScanCommand);
    expect(calls[0].args[0].input.ConsistentRead).toBe(true);
    expect(calls[1].args[0].input.ExclusiveStartKey).toEqual({ subscription_id: "01SUB" });
  });

  it("handles an empty table and fails loudly on a corrupt row", async () => {
    ddbMock.on(ScanCommand).resolvesOnce({}).resolvesOnce({ Items: [{ subscription_id: "BAD" }] });
    await expect(dao.listSubscriptions()).resolves.toEqual([]);
    await expect(dao.listSubscriptions()).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("WebhookSubscriptionDao.createSubscription", () => {
  it("puts with attribute_not_exists and surfaces a collision as TerminalError", async () => {
    ddbMock.on(PutCommand).resolvesOnce({}).rejectsOnce(new ConditionalCheckFailedException({ message: "exists", $metadata: {} }));
    await dao.createSubscription(subscription);
    expect(ddbMock.commandCalls(PutCommand)[0].args[0].input.ConditionExpression).toBe("attribute_not_exists(subscription_id)");
    await expect(dao.createSubscription(subscription)).rejects.toBeInstanceOf(TerminalError);
  });
});

describe("WebhookSubscriptionDao.replaceSubscription", () => {
  it("conditions the put on the expected version", async () => {
    ddbMock.on(PutCommand).resolves({});
    await dao.replaceSubscription({ ...subscription, version: 2 }, 1);
    const input = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(input.ConditionExpression).toBe("attribute_exists(subscription_id) AND #version = :expectedVersion");
    expect(input.ExpressionAttributeValues).toEqual({ ":expectedVersion": 1 });
    expect(input.ExpressionAttributeNames).toEqual({ "#version": "version" });
  });
});
