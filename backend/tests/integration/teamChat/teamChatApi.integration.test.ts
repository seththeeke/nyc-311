/**
 * Real-integration tier for Team Chat (docs/17-executive-team.md §14, L4):
 * every route against the live chat API. Reads run in Test and Prod. Writes
 * run in Test only, as the integration-test admin (who must be in
 * BOROUGH_SIM_TEAM) in the Test-only #integration-tests channel.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { TeamChatChannelSchema } from "../../../models/teamChatChannel";
import { TeamChatInboxEntrySchema } from "../../../models/teamChatInboxEntry";
import { TeamChatMessageSchema, type TeamChatMessage } from "../../../models/teamChatMessage";
import { callChatApi } from "../support/chatApiClient";
import { getTestAdminIdToken } from "../support/testAdminAuth";

const TARGET = process.env.INTEGRATION_TARGET;
const CHANNEL = "integration-tests";
const MESSAGES = `/channels/${CHANNEL}/messages`;
const parseMessage = (json: unknown): TeamChatMessage => TeamChatMessageSchema.parse(json);

describe.skipIf(TARGET === "local")("Team Chat reads against a live chat API", () => {
  it("lists the public channels, executive-team and tech-team among them", async () => {
    const { status, json, headers } = await callChatApi("chat-api GET /channels", "GET", "/channels");
    expect(status).toBe(200);
    const ids = (json as { items: unknown[] }).items.map((item) => TeamChatChannelSchema.parse(item).channel_id);
    expect(ids).toEqual(expect.arrayContaining(["executive-team", "tech-team"]));
    expect(headers.get("cache-control")).toContain("max-age=5");
  });

  it("reads a timeline page, and 404s an unknown channel and 400s a bad limit", async () => {
    const { status, json } = await callChatApi("chat-api GET /channels/{channel_id}/messages", "GET", "/channels/tech-team/messages?limit=5");
    expect(status).toBe(200);
    (json as { items: unknown[] }).items.forEach(parseMessage);
    expect((await callChatApi("chat-api GET /channels/{channel_id}/messages", "GET", "/channels/nope/messages", { track: false })).status).toBe(404);
    expect((await callChatApi("chat-api GET /channels/{channel_id}/messages", "GET", "/channels/tech-team/messages?limit=0", { track: false })).status).toBe(400);
  });

  it("refuses a write with no token at the authorizer", async () => {
    const { status } = await callChatApi("chat-api POST /channels/{channel_id}/messages", "POST", "/channels/tech-team/messages", { body: { text: "hi", client_token: "anonymous-1" }, track: false });
    expect(status).toBe(401);
  });
});

describe.skipIf(TARGET !== "test")("Team Chat writes against the live Test chat API", () => {
  let idToken: string;
  let root: TeamChatMessage;
  let reply: TeamChatMessage;
  const runId = randomUUID();

  beforeAll(async () => {
    idToken = await getTestAdminIdToken();
  });

  it("posts, and a replayed client_token returns the same message", async () => {
    const body = { text: `Integration run ${runId} @Tester`, tags: ["INTEGRATION_TEST"], client_token: `post-${runId}` };
    const first = await callChatApi("chat-api POST /channels/{channel_id}/messages", "POST", MESSAGES, { body, idToken });
    expect(first.status).toBe(201);
    root = parseMessage(first.json);
    expect(root).toMatchObject({ author_id: "integration-tester", author_kind: "HUMAN", tags: ["INTEGRATION_TEST"], mentions: ["integration-tester"] });
    const replay = await callChatApi("chat-api POST /channels/{channel_id}/messages", "POST", MESSAGES, { body, idToken, track: false });
    expect(replay.status).toBe(200);
    expect(parseMessage(replay.json).message_id).toBe(root.message_id);
  });

  it("refuses a reused token with a different body, a secret, and a channel the caller isn't in", async () => {
    expect((await callChatApi("chat-api POST /channels/{channel_id}/messages", "POST", MESSAGES, { body: { text: "different", client_token: `post-${runId}` }, idToken, track: false })).status).toBe(409);
    expect((await callChatApi("chat-api POST /channels/{channel_id}/messages", "POST", MESSAGES, { body: { text: "AKIAABCDEFGHIJKLMNOP", client_token: `secret-${runId}` }, idToken, track: false })).status).toBe(400);
    expect((await callChatApi("chat-api POST /channels/{channel_id}/messages", "POST", "/channels/tech-team/messages", { body: { text: "hi", client_token: `tech-${runId}` }, idToken, track: false })).status).toBe(403);
  });

  it("finds the post by polling the timeline after an older cursor", async () => {
    const { status, json } = await callChatApi("chat-api GET /channels/{channel_id}/messages", "GET", `${MESSAGES}?limit=10`);
    expect(status).toBe(200);
    expect((json as { items: TeamChatMessage[] }).items.map((m) => m.message_id)).toContain(root.message_id);
  });

  it("replies in the thread, and the thread shows it under the root", async () => {
    const posted = await callChatApi("chat-api POST /channels/{channel_id}/messages/{message_id}/replies", "POST", `${MESSAGES}/${root.message_id}/replies`, {
      body: { text: "Reply from the integration suite", client_token: `reply-${runId}` },
      idToken,
    });
    expect(posted.status).toBe(201);
    reply = parseMessage(posted.json);
    expect(reply.thread_id).toBe(root.message_id);
    const thread = await callChatApi("chat-api GET /channels/{channel_id}/messages/{message_id}/thread", "GET", `${MESSAGES}/${root.message_id}/thread`);
    expect(thread.status).toBe(200);
    const { root: threadRoot, replies } = thread.json as { root: TeamChatMessage; replies: { items: TeamChatMessage[] } };
    expect(threadRoot.reply_count).toBe(1);
    expect(replies.items.map((m) => m.message_id)).toEqual([reply.message_id]);
  });

  it("adds and removes a reaction, refusing an unsupported emoji", async () => {
    const path = `${MESSAGES}/${root.message_id}/reactions/${encodeURIComponent("✅")}`;
    expect((await callChatApi("chat-api PUT /channels/{channel_id}/messages/{message_id}/reactions/{emoji}", "PUT", path, { idToken })).status).toBe(204);
    const thread = await callChatApi("chat-api GET /channels/{channel_id}/messages/{message_id}/thread", "GET", `${MESSAGES}/${root.message_id}/thread`, { track: false });
    expect((thread.json as { root: TeamChatMessage }).root.reactions["✅"]).toEqual(["integration-tester"]);
    expect((await callChatApi("chat-api DELETE /channels/{channel_id}/messages/{message_id}/reactions/{emoji}", "DELETE", path, { idToken })).status).toBe(204);
    const unicorn = `${MESSAGES}/${root.message_id}/reactions/${encodeURIComponent("🦄")}`;
    expect((await callChatApi("chat-api PUT /channels/{channel_id}/messages/{message_id}/reactions/{emoji}", "PUT", unicorn, { idToken, track: false })).status).toBe(400);
  });

  it("edits, then deletes the reply and the root", async () => {
    const edited = await callChatApi("chat-api PATCH /channels/{channel_id}/messages/{message_id}", "PATCH", `${MESSAGES}/${root.message_id}`, { body: { text: `Edited ${runId}` }, idToken });
    expect(edited.status).toBe(200);
    expect(parseMessage(edited.json).edited_at).not.toBeNull();
    expect((await callChatApi("chat-api DELETE /channels/{channel_id}/messages/{message_id}", "DELETE", `${MESSAGES}/${reply.message_id}?thread_id=${root.message_id}`, { idToken })).status).toBe(204);
    expect((await callChatApi("chat-api DELETE /channels/{channel_id}/messages/{message_id}", "DELETE", `${MESSAGES}/${root.message_id}`, { idToken, track: false })).status).toBe(204);
  });

  it("reads the inbox and advances its cursor", async () => {
    const inbox = await callChatApi("chat-api GET /inbox", "GET", "/inbox?limit=5", { idToken });
    expect(inbox.status).toBe(200);
    const items = (inbox.json as { items: unknown[] }).items.map((item) => TeamChatInboxEntrySchema.parse(item));
    const entryId = items.at(-1)?.entry_id ?? "0";
    expect((await callChatApi("chat-api PUT /inbox/read", "PUT", "/inbox/read", { body: { entry_id: entryId }, idToken })).status).toBe(204);
  });
});
