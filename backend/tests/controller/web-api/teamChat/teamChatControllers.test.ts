import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "../../../../models/errors";
import * as service from "../../../../service/teamChat/teamChatService";
import { deleteMessageController } from "../../../../controller/web-api/teamChat/deleteMessageController";
import { deleteReactionController } from "../../../../controller/web-api/teamChat/deleteReactionController";
import { editMessageController } from "../../../../controller/web-api/teamChat/editMessageController";
import { getChannelMessagesController } from "../../../../controller/web-api/teamChat/getChannelMessagesController";
import { getInboxController } from "../../../../controller/web-api/teamChat/getInboxController";
import { getThreadController } from "../../../../controller/web-api/teamChat/getThreadController";
import { listChannelsController } from "../../../../controller/web-api/teamChat/listChannelsController";
import { markInboxReadController } from "../../../../controller/web-api/teamChat/markInboxReadController";
import { postMessageController } from "../../../../controller/web-api/teamChat/postMessageController";
import { postReplyController } from "../../../../controller/web-api/teamChat/postReplyController";
import { putReactionController } from "../../../../controller/web-api/teamChat/putReactionController";
import { PIP, TECH, message } from "../../../teamChatFixtures";

vi.mock("../../../../service/teamChat/teamChatService", () => ({
  listPublicChannels: vi.fn(),
  getTimeline: vi.fn(),
  getThread: vi.fn(),
  resolveCaller: vi.fn(),
  postMessage: vi.fn(),
  postReply: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
  setReaction: vi.fn(),
  getInbox: vi.fn(),
  markInboxRead: vi.fn(),
}));
const mocked = vi.mocked(service);

interface EventOptions {
  path?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  email?: string | null;
}

function event({ path = {}, query, body, email = PIP.email }: EventOptions = {}): unknown {
  return {
    rawPath: "/x",
    requestContext: { http: { method: "GET" }, ...(email ? { authorizer: { jwt: { claims: { email } } } } : {}) },
    pathParameters: path,
    queryStringParameters: query ?? null,
    body: body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body),
  };
}

const POST = { text: "Gears oiled", client_token: "token-123456" };
const MSG = { channel_id: "tech-team", message_id: "M1" };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocked.resolveCaller.mockResolvedValue(PIP);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("read controllers", () => {
  it("lists channels with cache headers", async () => {
    mocked.listPublicChannels.mockResolvedValue([TECH]);
    const response = await listChannelsController(event());
    expect(response).toMatchObject({ statusCode: 200, headers: { "Cache-Control": "public, max-age=5" } });
    expect(JSON.parse(response.body ?? "")).toEqual({ items: [TECH] });
  });

  it("passes the page query to the timeline and thread", async () => {
    mocked.getTimeline.mockResolvedValue({ items: [], next_cursor: null });
    mocked.getThread.mockResolvedValue({ root: message(), replies: { items: [], next_cursor: null } });
    expect((await getChannelMessagesController(event({ path: { channel_id: "tech-team" }, query: { after: "M1", limit: "20" } }))).statusCode).toBe(200);
    expect(mocked.getTimeline).toHaveBeenCalledWith("tech-team", { limit: 20, after: "M1" });
    expect((await getThreadController(event({ path: MSG, query: { before: "R1" } }))).statusCode).toBe(200);
    expect(mocked.getThread).toHaveBeenCalledWith("tech-team", "M1", { limit: 50, before: "R1" });
  });

  it("rejects a bad limit, both cursors and a missing path parameter with 400", async () => {
    const queries: Record<string, string>[] = [{ limit: "0" }, { limit: "abc" }, { before: "a", after: "b" }];
    for (const query of queries) {
      expect((await getChannelMessagesController(event({ path: { channel_id: "tech-team" }, query }))).statusCode).toBe(400);
    }
    expect((await getChannelMessagesController(event())).statusCode).toBe(400);
    expect((await getChannelMessagesController(event({ path: { channel_id: "%E0%A4%A" } }))).statusCode).toBe(400);
  });

  it("rejects a malformed event with 400 and maps an unexpected error to 500", async () => {
    expect((await listChannelsController({})).statusCode).toBe(400);
    mocked.listPublicChannels.mockRejectedValue(new Error("ddb down"));
    expect((await listChannelsController(event())).statusCode).toBe(500);
  });
});

describe("member controllers", () => {
  it("posts as the resolved caller: 201 new, 200 replayed", async () => {
    mocked.postMessage.mockResolvedValueOnce({ message: message(), replayed: false }).mockResolvedValueOnce({ message: message(), replayed: true });
    expect((await postMessageController(event({ path: { channel_id: "tech-team" }, body: POST }))).statusCode).toBe(201);
    expect((await postMessageController(event({ path: { channel_id: "tech-team" }, body: POST }))).statusCode).toBe(200);
    expect(mocked.resolveCaller).toHaveBeenCalledWith(PIP.email);
    expect(mocked.postMessage).toHaveBeenCalledWith(PIP, "tech-team", { ...POST, tags: [] });
  });

  it("replies, 201 new and 200 replayed", async () => {
    mocked.postReply.mockResolvedValueOnce({ message: message(), replayed: false }).mockResolvedValueOnce({ message: message(), replayed: true });
    expect((await postReplyController(event({ path: MSG, body: POST }))).statusCode).toBe(201);
    expect((await postReplyController(event({ path: MSG, body: POST }))).statusCode).toBe(200);
    expect(mocked.postReply).toHaveBeenCalledWith(PIP, "tech-team", "M1", expect.objectContaining({ text: "Gears oiled" }));
  });

  it("rejects a non-JSON or invalid body with 400", async () => {
    expect((await postMessageController(event({ path: { channel_id: "tech-team" }, body: "{nope" }))).statusCode).toBe(400);
    expect((await postMessageController(event({ path: { channel_id: "tech-team" }, body: { text: "" } }))).statusCode).toBe(400);
  });

  it("refuses a token with no email claim with 403", async () => {
    expect((await postMessageController(event({ path: { channel_id: "tech-team" }, body: POST, email: null }))).statusCode).toBe(403);
  });

  it("edits and deletes with an optional thread_id", async () => {
    mocked.editMessage.mockResolvedValue(message({ text: "x" }));
    expect((await editMessageController(event({ path: MSG, query: { thread_id: "ROOT" }, body: { text: "x" } }))).statusCode).toBe(200);
    expect(mocked.editMessage).toHaveBeenCalledWith(PIP, "tech-team", "M1", "ROOT", { text: "x" });
    const deleted = await deleteMessageController(event({ path: MSG }));
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBeUndefined();
    expect(mocked.deleteMessage).toHaveBeenCalledWith(PIP, "tech-team", "M1", null);
  });

  it("adds and removes a decoded emoji, refusing unsupported ones", async () => {
    expect((await putReactionController(event({ path: { ...MSG, emoji: encodeURIComponent("✅") } }))).statusCode).toBe(204);
    expect((await deleteReactionController(event({ path: { ...MSG, emoji: "✅" } }))).statusCode).toBe(204);
    expect(mocked.setReaction.mock.calls.map((call) => call[5])).toEqual([true, false]);
    expect((await putReactionController(event({ path: { ...MSG, emoji: "🦄" } }))).statusCode).toBe(400);
    expect((await deleteReactionController(event({ path: { ...MSG, emoji: "🦄" } }))).statusCode).toBe(400);
  });

  it("reads the inbox and marks it read", async () => {
    mocked.getInbox.mockResolvedValue({ items: [], next_cursor: null });
    expect((await getInboxController(event({ query: { limit: "5" } }))).statusCode).toBe(200);
    expect((await markInboxReadController(event({ body: { entry_id: "E1" } }))).statusCode).toBe(204);
    expect(mocked.markInboxRead).toHaveBeenCalledWith(PIP, "E1");
  });

  it.each([
    [new ValidationError("bad"), 400],
    [new ForbiddenError("no"), 403],
    [new NotFoundError("gone"), 404],
    [new ConflictError("dup"), 409],
    [new RateLimitedError("slow"), 429],
  ])("maps %s to its status", async (error, status) => {
    mocked.postMessage.mockRejectedValue(error);
    const response = await postMessageController(event({ path: { channel_id: "tech-team" }, body: POST }));
    expect(response.statusCode).toBe(status);
    expect(JSON.parse(response.body ?? "")).toEqual({ message: error.message });
  });

  it("maps a non-Error rejection to 500", async () => {
    mocked.postMessage.mockRejectedValue("weird");
    expect((await postMessageController(event({ path: { channel_id: "tech-team" }, body: POST }))).statusCode).toBe(500);
  });
});
