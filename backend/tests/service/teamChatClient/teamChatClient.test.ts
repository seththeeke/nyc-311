import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamChatClient } from "../../../service/teamChatClient/teamChatClient";

const NOW = new Date("2026-11-01T10:00:00.000Z");
const jwt = (exp: number): string => `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;
const FRESH = jwt(NOW.getTime() / 1000 + 3600);
const STALE = jwt(NOW.getTime() / 1000 + 30);
const CONFIG = { TEAM_CHAT_API_URL: "https://chat.example.com", TEAM_CHAT_ID_TOKEN: FRESH, TEAM_CHAT_REFRESH_TOKEN: "refresh", TEAM_CHAT_CLIENT_ID: "client", TEAM_CHAT_REGION: "us-east-1" };

const json = (status: number, body: unknown): Response => new Response(body === null ? null : JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
const client = (config = CONFIG): TeamChatClient => new TeamChatClient(config, { fetch: fetchMock as unknown as typeof fetch, now: () => NOW, newToken: () => "tok-123456" });

beforeEach(() => {
  fetchMock = vi.fn(async () => json(200, { ok: true }));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const call = (i = 0): [string, RequestInit] => fetchMock.mock.calls[i] as [string, RequestInit];

describe("TeamChatClient reads", () => {
  it("reads channels, a channel with its query and a thread without a token", async () => {
    await client().listChannels();
    await client().readChannel("tech team", { after: "M1", limit: 5, before: undefined });
    await client().readChannel("tech-team", {});
    await client().readThread("tech-team", "M1");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://chat.example.com/channels",
      "https://chat.example.com/channels/tech%20team/messages?after=M1&limit=5",
      "https://chat.example.com/channels/tech-team/messages",
      "https://chat.example.com/channels/tech-team/messages/M1/thread",
    ]);
    expect((call(1)[1].headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("reads the inbox and marks it read with the ID token", async () => {
    expect(await client().readInbox({ after: "E1" })).toEqual({ status: 200, body: { ok: true } });
    await client().readInbox({});
    await client().markInboxRead("E2");
    expect(call(0)[0]).toBe("https://chat.example.com/inbox?after=E1");
    expect(call(1)[0]).toBe("https://chat.example.com/inbox");
    expect((call(2)[1].headers as Record<string, string>).Authorization).toBe(`Bearer ${FRESH}`);
    expect(JSON.parse(String(call(2)[1].body))).toEqual({ entry_id: "E2" });
  });

  it("returns a null body for an empty response", async () => {
    fetchMock.mockResolvedValueOnce(json(204, null));
    expect(await client().markInboxRead("E1")).toEqual({ status: 204, body: null });
  });
});

describe("TeamChatClient writes", () => {
  it("posts and replies with a client_token, and edits and reacts on replies", async () => {
    await client().postMessage("tech-team", "hi", ["DEVX_RUN"]);
    await client().reply("tech-team", "M1", "re", []);
    await client().editMessage("tech-team", "R1", "M1", "edited");
    await client().editMessage("tech-team", "M1", undefined, "edited");
    await client().react("tech-team", "R1", "M1", "✅", false);
    await client().react("tech-team", "M1", undefined, "✅", true);
    expect(JSON.parse(String(call(0)[1].body))).toEqual({ text: "hi", tags: ["DEVX_RUN"], client_token: "tok-123456" });
    expect(call(1)[0]).toBe("https://chat.example.com/channels/tech-team/messages/M1/replies");
    expect(call(2)).toEqual([expect.stringContaining("/messages/R1?thread_id=M1"), expect.objectContaining({ method: "PATCH" })]);
    expect(call(3)[0]).toBe("https://chat.example.com/channels/tech-team/messages/M1");
    expect(call(4)).toEqual([`https://chat.example.com/channels/tech-team/messages/R1/reactions/${encodeURIComponent("✅")}?thread_id=M1`, expect.objectContaining({ method: "PUT" })]);
    expect(call(5)[1].method).toBe("DELETE");
  });

  it("retries a 5xx or a network error with the same client_token, then gives up", async () => {
    fetchMock.mockResolvedValueOnce(json(503, {})).mockRejectedValueOnce(new Error("reset")).mockResolvedValueOnce(json(201, { message_id: "M9" }));
    expect(await client().postMessage("tech-team", "hi", [])).toEqual({ status: 201, body: { message_id: "M9" } });
    expect(new Set(fetchMock.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)).client_token))).toEqual(new Set(["tok-123456"]));
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(503, { message: "down" }));
    expect((await client().postMessage("tech-team", "hi", [])).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue("offline");
    await expect(client().readInbox({})).rejects.toBe("offline");
  });
});

describe("TeamChatClient token refresh", () => {
  it("refreshes a near-expiry or unreadable token through Cognito, once", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { AuthenticationResult: { IdToken: FRESH } }));
    const chat = client({ ...CONFIG, TEAM_CHAT_ID_TOKEN: STALE });
    await chat.readInbox({});
    await chat.readInbox({});
    expect(call(0)[0]).toBe("https://cognito-idp.us-east-1.amazonaws.com/");
    expect(JSON.parse(String(call(0)[1].body))).toMatchObject({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: "client", AuthParameters: { REFRESH_TOKEN: "refresh" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => json(200, { AuthenticationResult: { IdToken: FRESH } }));
    await client({ ...CONFIG, TEAM_CHAT_ID_TOKEN: "not-a-jwt" }).readInbox({});
    await client({ ...CONFIG, TEAM_CHAT_ID_TOKEN: `h.${Buffer.from("{}").toString("base64url")}.s` }).readInbox({});
    expect(call(0)[0]).toContain("cognito-idp");
  });

  it("throws when the refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(json(400, {}));
    await expect(client({ ...CONFIG, TEAM_CHAT_ID_TOKEN: STALE }).readInbox({})).rejects.toThrow("Cognito token refresh failed: HTTP 400");
  });

  it("uses the real fetch, clock and token generator by default", () => {
    expect(new TeamChatClient(CONFIG)).toBeInstanceOf(TeamChatClient);
  });
});
