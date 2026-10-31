import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";
import { TerminalError } from "../../../models/errors";
import type { IdeaResolution } from "../../../models/residentIdea";
import { featureIdea, idea, searchStep } from "../../residentFixtures";

const ddbMock = mockClient(DynamoDBDocumentClient);
const dao = new ResidentIdeaDao(ddbMock as unknown as DynamoDBDocumentClient, "ResidentIdeas-Prod", "Residents-Prod");
const thread = { persona_id: "hawthorn", sk: "ORDER#01ORDER", order_id: "01ORDER", idea_count: 1, first_idea_at: "a", last_idea_at: "a" };

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ResidentIdeaDao reads", () => {
  it("lists one resident's ideas newest first through ByResident, so no step rows", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [idea], LastEvaluatedKey: { persona_id: "hawthorn", sk: idea.sk } });
    const page = await dao.listForResident("hawthorn", 20, undefined);
    expect(page.items).toEqual([idea]);
    expect(page.lastKey).not.toBeNull();
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      IndexName: "ByResident",
      KeyConditionExpression: "resident_pk = :persona",
      ScanIndexForward: false,
      ExpressionAttributeValues: { ":persona": "hawthorn" },
    });
  });

  it("lists every resident's ideas through the Feed index", async () => {
    ddbMock.on(QueryCommand).resolves({});
    await expect(dao.listFeed(20, { feed_pk: "ALL" })).resolves.toEqual({ items: [], lastKey: null });
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({ IndexName: "Feed", ScanIndexForward: false });
  });

  it("gets an idea and its steps in order from one consistent query, across pages", async () => {
    const step2 = { ...searchStep, sk: `${idea.sk}#STEP#0002`, sequence: 2 };
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [idea, searchStep], LastEvaluatedKey: { persona_id: "hawthorn", sk: searchStep.sk } })
      .resolvesOnce({ Items: [step2] });
    await expect(dao.getIdeaWithSteps("hawthorn", idea.idea_id)).resolves.toEqual({ idea, steps: [searchStep, step2] });
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({
      KeyConditionExpression: "persona_id = :persona AND begins_with(sk, :idea)",
      ExpressionAttributeValues: { ":persona": "hawthorn", ":idea": idea.sk },
      ConsistentRead: true,
    });
  });

  it("returns null for an unknown idea, or steps with no idea row", async () => {
    ddbMock.on(QueryCommand).resolvesOnce({ Items: [] }).resolvesOnce({ Items: [searchStep] });
    await expect(dao.getIdeaWithSteps("hawthorn", "nope")).resolves.toBeNull();
    await expect(dao.getIdeaWithSteps("hawthorn", idea.idea_id)).resolves.toBeNull();
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
    ddbMock.on(QueryCommand).resolves({ Items: [{ ...idea, idea_type: "GOSSIP" }] });
    await expect(dao.getIdeaWithSteps("hawthorn", idea.idea_id)).rejects.toThrow("ResidentIdeas-Prod");
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

describe("ResidentIdeaDao.appendStep", () => {
  const resolution: IdeaResolution = {
    status: "IN_PROGRESS",
    summary: null,
    follow_up: null,
    tools_used: ["SEARCH_REQUESTS"],
    step_count: 1,
    last_step_sequence: 1,
    started_at: "2026-11-02T22:14:00.000Z",
    finished_at: null,
    prompt_version: "idea-actioner@1",
    input_tokens: 940,
    output_tokens: 38,
  };

  it("writes the step and the idea's resolution in one transaction, conditioned on the previous step", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await dao.appendStep(searchStep, resolution);
    const [put, update] = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(put.Put).toMatchObject({ Item: searchStep, ConditionExpression: "attribute_not_exists(sk)" });
    expect(update.Update).toMatchObject({
      Key: { persona_id: "hawthorn", sk: idea.sk },
      UpdateExpression: "SET resolution = :resolution",
      ExpressionAttributeValues: { ":resolution": resolution, ":previous": 0 },
    });
    expect(update.Update?.ConditionExpression).toContain("resolution.last_step_sequence = :previous");
  });

  it("refuses a step that already exists or skips ahead", async () => {
    ddbMock.on(TransactWriteCommand).rejects(new TransactionCanceledException({ message: "cancelled", $metadata: {} }));
    await expect(dao.appendStep(searchStep, resolution)).rejects.toThrow(TerminalError);
  });

  it("rethrows any other failure, and validates the step first", async () => {
    ddbMock.on(TransactWriteCommand).rejects(new Error("throttled"));
    await expect(dao.appendStep(searchStep, resolution)).rejects.toThrow("throttled");
    await expect(dao.appendStep({ ...searchStep, sk: idea.sk }, resolution)).rejects.toThrow("ResidentIdeas-Prod");
  });

  it("adds the step's memory updates to the same transaction", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await dao.appendStep(searchStep, resolution, [
      { kind: "ORDER_CHECKED", order_id: "01ORDER", status: "SCHEDULED", scheduled_window: { start: "S", end: "E" }, at: "AT" },
      { kind: "FEATURE_REQUEST_FILED", feature_request_id: "01FR", title: "Texts", idea_id: idea.idea_id, status: "RECEIVED", status_reason: null, at: "AT" },
      { kind: "FEATURE_REQUEST_CHECKED", feature_request_id: "01FR", status: "CLOSED", status_reason: "Shipped", at: "AT2" },
    ]);
    const items = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(items).toHaveLength(5);
    expect(items[2].Update).toMatchObject({
      Key: { persona_id: "hawthorn", sk: "ORDER#01ORDER" },
      ConditionExpression: "attribute_exists(sk)",
      ExpressionAttributeValues: { ":status": "SCHEDULED", ":window": { start: "S", end: "E" }, ":at": "AT" },
    });
    expect(items[3].Update).toMatchObject({
      Key: { persona_id: "hawthorn", sk: "FEATURE_REQUEST#01FR" },
      ExpressionAttributeValues: { ":id": "01FR", ":title": "Texts", ":idea": idea.idea_id, ":status": "RECEIVED", ":reason": null },
    });
    expect(items[3].Update?.ConditionExpression).toBeUndefined();
    expect(items[3].Update?.UpdateExpression).toContain("if_not_exists(created_at, :at)");
    expect(items[4].Update).toMatchObject({ ConditionExpression: "attribute_exists(sk)", ExpressionAttributeValues: { ":status": "CLOSED", ":reason": "Shipped", ":at": "AT2" } });
  });
});

describe("ResidentIdeaDao.listFeatureRequestThreads", () => {
  const thread = {
    persona_id: "hawthorn",
    sk: "FEATURE_REQUEST#01FR",
    feature_request_id: "01FR",
    title: "Texts",
    filed_by_idea_id: idea.idea_id,
    last_known_status: "RECEIVED",
    last_known_status_reason: null,
    last_checked_at: "AT",
    created_at: "AT",
  };

  it("reads every feature-request thread across pages", async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [thread], LastEvaluatedKey: { persona_id: "hawthorn", sk: thread.sk } })
      .resolvesOnce({});
    await expect(dao.listFeatureRequestThreads("hawthorn")).resolves.toEqual([thread]);
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input.ExpressionAttributeValues).toEqual({ ":persona": "hawthorn", ":prefix": "FEATURE_REQUEST#" });
  });
});
