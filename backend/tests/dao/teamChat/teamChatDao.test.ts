import { DynamoDBClient, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamChatDao, messageKey, type CreateMessageInput } from "../../../dao/teamChat/teamChatDao";
import { ConflictError, NotFoundError, RateLimitedError, ValidationError } from "../../../models/errors";
import { PIP, TECH, message } from "../../teamChatFixtures";

const ddbMock = mockClient(DynamoDBDocumentClient);
const TABLE = "TeamChat-Test";
const dao = (): TeamChatDao => new TeamChatDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), TABLE);

function cancelled(codes: string[]): TransactionCanceledException {
  return new TransactionCanceledException({ message: "cancelled", $metadata: {}, CancellationReasons: codes.map((Code) => ({ Code })) });
}

function createInput(overrides: Partial<CreateMessageInput> = {}): CreateMessageInput {
  return {
    message: message(),
    clientToken: "token-123456",
    bodyHash: "hash-a",
    writeCap: 200,
    day: "2026-11-01",
    inbox: [{ member_id: "cto", entry_id: "01E1", kind: "MENTION", channel_id: "tech-team", message_id: "01M0000000000000000000000A", thread_id: null, author_id: "devx", created_at: "2026-11-01T10:00:00.000Z" }],
    nowEpochSeconds: 1_000,
    ...overrides,
  };
}

beforeEach(() => {
  ddbMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("messageKey", () => {
  it("keys top-level messages under MESSAGE# and replies under THREAD#root#", () => {
    expect(messageKey("tech-team", "M1", null)).toEqual({ pk: "CHANNEL#tech-team", sk: "MESSAGE#M1" });
    expect(messageKey("tech-team", "R1", "M1")).toEqual({ pk: "CHANNEL#tech-team", sk: "THREAD#M1#R1" });
  });
});

describe("TeamChatDao reads", () => {
  it("lists channels and members from the WORKSPACE partition", async () => {
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ":pk": "WORKSPACE", ":prefix": "CHANNEL#" } }).resolves({ Items: [{ pk: "WORKSPACE", sk: "CHANNEL#tech-team", ...TECH }] });
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ":pk": "WORKSPACE", ":prefix": "MEMBER#" } }).resolves({ Items: [{ ...PIP }] });
    expect(await dao().listChannels()).toEqual([TECH]);
    expect(await dao().listMembers()).toEqual([PIP]);
  });

  it("returns empty lists when a query finds nothing", async () => {
    ddbMock.on(QueryCommand).resolves({});
    expect(await dao().listChannels()).toEqual([]);
  });

  it("throws ValidationError on a malformed stored row", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ channel_id: "BAD ID" }] });
    await expect(dao().listChannels()).rejects.toBeInstanceOf(ValidationError);
  });

  it("gets a channel or null", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: { ...TECH } }).resolvesOnce({});
    expect(await dao().getChannel("tech-team")).toEqual(TECH);
    expect(await dao().getChannel("nope")).toBeNull();
  });

  it("gets a message, turning stored string sets into sorted arrays", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: { ...message(), reactions: { "✅": new Set(["cto", "ceo"]) }, reply_author_ids: new Set(["cto"]) } }).resolvesOnce({});
    const found = await dao().getMessage("tech-team", "01M0000000000000000000000A", null);
    expect(found?.reactions).toEqual({ "✅": ["ceo", "cto"] });
    expect(found?.reply_author_ids).toEqual(["cto"]);
    expect(await dao().getMessage("tech-team", "missing", "root")).toBeNull();
  });

  it("pages the timeline newest first, dropping the cursor row", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [message({ message_id: "M3" }), message({ message_id: "M2" })] });
    expect((await dao().listTimeline("tech-team", { limit: 10 })).map((m) => m.message_id)).toEqual(["M3", "M2"]);
    expect((await dao().listTimeline("tech-team", { limit: 10, before: "M2" })).map((m) => m.message_id)).toEqual(["M3"]);
    expect((await dao().listTimeline("tech-team", { limit: 10, after: "M2" })).map((m) => m.message_id)).toEqual(["M3"]);
    const calls = ddbMock.commandCalls(QueryCommand).map((call) => call.args[0].input);
    expect(calls[0]).toMatchObject({ ScanIndexForward: false, Limit: 11, ExpressionAttributeValues: { ":lo": "MESSAGE#" } });
    expect(calls[1].ExpressionAttributeValues).toMatchObject({ ":lo": "MESSAGE#", ":hi": "MESSAGE#M2" });
    expect(calls[2].ExpressionAttributeValues).toMatchObject({ ":lo": "MESSAGE#M2", ":hi": "MESSAGE#~" });
  });

  it("lists a thread's replies oldest first, after a cursor", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [message({ message_id: "R1", thread_id: "M1" }), message({ message_id: "R2", thread_id: "M1" })] });
    expect((await dao().listReplies("tech-team", "M1", { limit: 5 })).map((m) => m.message_id)).toEqual(["R1", "R2"]);
    expect((await dao().listReplies("tech-team", "M1", { limit: 5, after: "R1" })).map((m) => m.message_id)).toEqual(["R2"]);
    expect(ddbMock.commandCalls(QueryCommand)[1].args[0].input.ExpressionAttributeValues).toMatchObject({ ":lo": "THREAD#M1#R1", ":hi": "THREAD#M1#~" });
  });

  it("lists the inbox after a cursor", async () => {
    const entry = createInput().inbox[0];
    ddbMock.on(QueryCommand).resolves({ Items: [{ ...entry }] });
    expect(await dao().listInbox("cto", { limit: 5, after: "01E0" })).toEqual([entry]);
    expect(await dao().listInbox("cto", { limit: 5 })).toEqual([entry]);
    expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toMatchObject({ KeyConditionExpression: "pk = :pk AND sk > :after" });
  });
});

describe("TeamChatDao.createMessage", () => {
  it("writes the message, marker, counter, channel summary and inbox in one transaction", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    const result = await dao().createMessage(createInput());
    expect(result.replayed).toBe(false);
    const items = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(items).toHaveLength(5);
    expect(items[0].Put?.Item).toMatchObject({ pk: "CHANNEL#tech-team", sk: "MESSAGE#01M0000000000000000000000A" });
    expect(items[0].Put?.Item).not.toHaveProperty("reply_author_ids");
    expect(items[1].Put?.Item).toMatchObject({ pk: "CLIENT#devx#token-123456", expires_at: 1_000 + 86_400 });
    expect(items[2].Update?.Key).toEqual({ pk: "WRITES#devx", sk: "2026-11-01" });
    expect(items[3].Update?.Key).toEqual({ pk: "WORKSPACE", sk: "CHANNEL#tech-team" });
    expect(items[4].Put?.Item).toMatchObject({ pk: "INBOX#cto", sk: "01E1" });
  });

  it("updates the root's thread summary for a reply", async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    await dao().createMessage(createInput({ message: message({ message_id: "R1", thread_id: "M1" }), inbox: [] }));
    const items = ddbMock.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems ?? [];
    expect(items[0].Put?.Item).toMatchObject({ sk: "THREAD#M1#R1" });
    expect(items[3].Update?.Key).toEqual({ pk: "CHANNEL#tech-team", sk: "MESSAGE#M1" });
  });

  it("returns the original message when the client_token was already used with the same body", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["None", "ConditionalCheckFailed", "None", "None"]));
    ddbMock.on(GetCommand, { Key: { pk: "CLIENT#devx#token-123456", sk: "CLIENT" } }).resolves({ Item: { message_id: "ORIG", channel_id: "tech-team", thread_id: null, body_hash: "hash-a" } });
    ddbMock.on(GetCommand, { Key: { pk: "CHANNEL#tech-team", sk: "MESSAGE#ORIG" } }).resolves({ Item: message({ message_id: "ORIG" }) });
    const result = await dao().createMessage(createInput());
    expect(result).toMatchObject({ replayed: true, message: { message_id: "ORIG" } });
  });

  it("refuses a reused client_token with a different body", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["None", "ConditionalCheckFailed"]));
    ddbMock.on(GetCommand).resolves({ Item: { message_id: "ORIG", channel_id: "tech-team", thread_id: null, body_hash: "other" } });
    await expect(dao().createMessage(createInput())).rejects.toBeInstanceOf(ConflictError);
  });

  it("reports a replayed message that's gone as not found", async () => {
    ddbMock.on(TransactWriteCommand).rejects(cancelled(["None", "ConditionalCheckFailed"]));
    ddbMock.on(GetCommand, { Key: { pk: "CLIENT#devx#token-123456", sk: "CLIENT" } }).resolves({ Item: { message_id: "ORIG", channel_id: "tech-team", thread_id: null, body_hash: "hash-a" } });
    ddbMock.on(GetCommand, { Key: { pk: "CHANNEL#tech-team", sk: "MESSAGE#ORIG" } }).resolves({});
    await expect(dao().createMessage(createInput())).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps the counter and summary conditions to RateLimitedError and NotFoundError", async () => {
    ddbMock.on(TransactWriteCommand).rejectsOnce(cancelled(["None", "None", "ConditionalCheckFailed", "None"])).rejectsOnce(cancelled(["None", "None", "None", "ConditionalCheckFailed"]));
    await expect(dao().createMessage(createInput())).rejects.toBeInstanceOf(RateLimitedError);
    await expect(dao().createMessage(createInput({ message: message({ thread_id: "M1" }) }))).rejects.toThrow("Thread root not found");
  });

  it("reports a missing channel and rethrows other failures", async () => {
    ddbMock.on(TransactWriteCommand).rejectsOnce(cancelled(["None", "None", "None", "ConditionalCheckFailed"])).rejectsOnce(cancelled(["TransactionConflict"])).rejectsOnce(new Error("boom"));
    await expect(dao().createMessage(createInput())).rejects.toThrow("Channel not found");
    await expect(dao().createMessage(createInput())).rejects.toBeInstanceOf(TransactionCanceledException);
    await expect(dao().createMessage(createInput())).rejects.toThrow("boom");
  });
});

describe("TeamChatDao updates", () => {
  beforeEach(() => {
    ddbMock.on(UpdateCommand).resolves({});
  });

  it("edits text and mentions, and tombstones", async () => {
    await dao().updateText(message(), "New text", ["cto"], "2026-11-01T11:00:00.000Z");
    await dao().tombstone(message({ thread_id: "M1", message_id: "R1" }), "2026-11-01T12:00:00.000Z");
    const [edit, tomb] = ddbMock.commandCalls(UpdateCommand).map((call) => call.args[0].input);
    expect(edit.ExpressionAttributeValues).toMatchObject({ ":text": "New text", ":mentions": ["cto"] });
    expect(tomb).toMatchObject({ Key: { sk: "THREAD#M1#R1" }, ExpressionAttributeValues: { ":empty": "" } });
  });

  it("adds and removes a reaction as a string-set change", async () => {
    await dao().setReaction(message(), "✅", "cto", true);
    await dao().setReaction(message(), "✅", "cto", false);
    const [add, remove] = ddbMock.commandCalls(UpdateCommand).map((call) => call.args[0].input);
    expect(add.UpdateExpression).toBe("ADD reactions.#emoji :member");
    expect(remove.UpdateExpression).toBe("DELETE reactions.#emoji :member");
    expect(add.ExpressionAttributeValues?.[":member"]).toEqual(new Set(["cto"]));
  });

  it("sets the inbox cursor and upserts seeds without touching their state", async () => {
    await dao().setInboxRead("cto", "01E9");
    await dao().upsertChannel({ channel_id: "tech-team", name: "tech-team", topic: "t", member_ids: ["cto"], visibility: "PUBLIC" });
    await dao().upsertMember({ member_id: "cto", handle: "Rex", kind: "AGENT", email: "cto-agent@agents.boroughsim.com", status: "ACTIVE" });
    const [read, channel, member] = ddbMock.commandCalls(UpdateCommand).map((call) => call.args[0].input);
    expect(read).toMatchObject({ Key: { pk: "WORKSPACE", sk: "MEMBER#cto" }, ExpressionAttributeValues: { ":id": "01E9" } });
    expect(channel.UpdateExpression).toContain("if_not_exists(last_message_id, :null)");
    expect(member.UpdateExpression).toContain("if_not_exists(inbox_read_id, :null)");
  });
});
