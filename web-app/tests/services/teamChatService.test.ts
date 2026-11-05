import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_TEAM_CHAT_CHANNELS, MOCK_TEAM_CHAT_MESSAGES } from "../../src/test-data/teamChat";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function service(mode: "mock" | "live") {
  vi.stubEnv("VITE_DATA_MODE", mode);
  vi.stubEnv("VITE_TEAM_DATA_MODE", "");
  return (await import("../../src/services/teamChatService")).teamChatService;
}

describe("teamChatService — mock", () => {
  it("lists channels, a channel's top-level messages newest first, and a thread", async () => {
    const chat = await service("mock");
    expect(await chat.listChannels()).toEqual(MOCK_TEAM_CHAT_CHANNELS);
    const page = await chat.listMessages("tech-team");
    expect(page.items.map((m) => m.message_id)).toEqual(["T3", "T2", "T1"]);
    const thread = await chat.getThread("tech-team", "T1");
    expect(thread.replies.items.map((m) => m.message_id)).toEqual(["T1a"]);
    await expect(chat.getThread("tech-team", "nope")).rejects.toThrow("404");
  });
});

describe("teamChatService — live", () => {
  it("reads the chat API and parses every response", async () => {
    const message = MOCK_TEAM_CHAT_MESSAGES[0];
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.endsWith("/channels") ? { items: MOCK_TEAM_CHAT_CHANNELS } : url.includes("/thread") ? { root: message, replies: { items: [], next_cursor: null } } : { items: [message], next_cursor: null };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const chat = await service("live");
    expect(await chat.listChannels()).toHaveLength(3);
    expect((await chat.listMessages("tech team")).items).toHaveLength(1);
    expect((await chat.getThread("tech-team", "E1")).root.message_id).toBe("E1");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "https://chat-api.test.boroughsim.com/channels",
      "https://chat-api.test.boroughsim.com/channels/tech%20team/messages?limit=100",
      "https://chat-api.test.boroughsim.com/channels/tech-team/messages/E1/thread?limit=100",
    ]);
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const chat = await service("live");
    await expect(chat.listChannels()).rejects.toThrow("GET /channels failed: HTTP 503");
  });
});
