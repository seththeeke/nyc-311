import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";
import { featureIdea, idea } from "../../residentFixtures";

const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new ResidentIdeaDao(ddbMock as unknown as DynamoDBDocumentClient, "ResidentIdeas-Prod", "Residents-Prod");
const thread = { persona_id: "hawthorn", sk: "ORDER#01ORDER", order_id: "01ORDER", idea_count: 1, first_idea_at: "a", last_idea_at: "a" };

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ResidentIdeaDao reads", () => {
  it("lists one resident's ideas newest first", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [idea], LastEvaluatedKey: { persona_id: "hawthorn", sk: idea.sk } });
    const page = await dao.listForResident("hawthorn", 20, undefined);
    expect(page.items).toEqual([idea]);
    expect(page.lastKey).not.toBeNull();
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({ ScanIndexForward: false, ExpressionAttributeValues: { ":prefix": "IDEA#" } });
  });

  it("lists every resident's ideas through the Feed index", async () => {
    ddbMock.on(QueryCommand).resolves({});
    await expect(dao.listFeed(20, { feed_pk: "ALL" })).resolves.toEqual({ items: [], lastKey: null });
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({ IndexName: "Feed", ScanIndexForward: false });
  });

  it("gets one idea, or null", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: idea }).resolvesOnce({});
    await expect(dao.getIdea("hawthorn", idea.idea_id)).resolves.toEqual(idea);
    await expect(dao.getIdea("hawthorn", "nope")).resolves.toBeNull();
  });

  it("reads every thread row across pages", async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [thread], LastEvaluatedKey: { persona_id: "hawthorn", sk: thread.sk } })
      .resolvesOnce({ Items: [{ ...thread, sk: "ORDER#02", order_id: "02" }] });
    await expect(dao.listThreads("hawthorn")).resolves.toHaveLength(2);
  });

  it("treats a page with no Items as empty", async () => {
    ddbMock.on(QueryCommand).resolves({});
    await expect(dao.listForResident("hawthorn", 20, undefined)).resolves.toEqual({ items: [], lastKey: null });
    await expect(dao.listThreads("hawthorn")).resolves.toEqual([]);
  });

  it("rejects a malformed stored idea", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...idea, idea_type: "GOSSIP" } });
    await expect(dao.getIdea("hawthorn", idea.idea_id)).rejects.toThrow("ResidentIdeas-Prod");
  });
});

describe("ResidentIdeaDao.recordIdea", () => {
  it("writes the idea, its thread row and the resident's counters together", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await dao.recordIdea(idea);
    const items = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(items).toHaveLength(3);
    expect(items[0].Put?.ConditionExpression).toBe("attribute_not_exists(sk)");
    expect(items[1].Update?.Key).toEqual({ persona_id: "hawthorn", sk: "ORDER#01ORDER" });
    expect(items[2].Update).toMatchObject({ TableName: "Residents-Prod", Key: { persona_id: "hawthorn", sk: "CURRENT" }, ConditionExpression: "attribute_exists(sk)" });
  });

  it("writes no thread row for an idea about the service", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await dao.recordIdea(featureIdea);
    expect(ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems).toHaveLength(2);
  });
});
