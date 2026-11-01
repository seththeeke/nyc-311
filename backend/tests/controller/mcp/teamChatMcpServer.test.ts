import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTeamChatMcpServer, isEntryPoint, main, runTool, startIfEntryPoint } from "../../../controller/mcp/teamChatMcpServer";
import { TEAM_CHAT_TOOLS, type TeamChatTool } from "../../../controller/mcp/teamChatTools";
import type { TeamChatClient } from "../../../service/teamChatClient/teamChatClient";

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({ StdioServerTransport: class {} }));
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool = vi.fn();
    connect = vi.fn().mockResolvedValue(undefined);
  },
}));

const ok = { status: 200, body: { items: [] } };
function fakeClient(): Record<string, ReturnType<typeof vi.fn>> {
  return Object.fromEntries(
    ["listChannels", "readChannel", "readThread", "readInbox", "markInboxRead", "postMessage", "reply", "editMessage", "react"].map((name) => [name, vi.fn().mockResolvedValue(ok)])
  );
}

const originalLog = console.log;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  console.log = originalLog;
  vi.restoreAllMocks();
});

const byName = (name: string): TeamChatTool => {
  const found = (TEAM_CHAT_TOOLS as TeamChatTool[]).find((tool) => tool.name === name);
  if (!found) throw new Error(name);
  return found;
};

describe("team-chat tools", () => {
  it("map each tool's arguments onto the client", async () => {
    const client = fakeClient();
    const c = client as unknown as TeamChatClient;
    await byName("list_channels").run(c, {});
    await byName("read_channel").run(c, { channel_id: "tech-team", after: "M1" });
    await byName("read_thread").run(c, { channel_id: "tech-team", message_id: "M1" });
    await byName("read_inbox").run(c, { limit: 5 });
    await byName("mark_inbox_read").run(c, { entry_id: "E1" });
    await byName("post_message").run(c, { channel_id: "tech-team", text: "hi", tags: ["DEVX_RUN"] });
    await byName("reply").run(c, { channel_id: "tech-team", message_id: "M1", text: "re", tags: [] });
    await byName("edit_message").run(c, { channel_id: "tech-team", message_id: "R1", thread_id: "M1", text: "e" });
    await byName("react").run(c, { channel_id: "tech-team", message_id: "M1", emoji: "✅", remove: true });
    expect(client.readChannel).toHaveBeenCalledWith("tech-team", { after: "M1", before: undefined, limit: undefined });
    expect(client.postMessage).toHaveBeenCalledWith("tech-team", "hi", ["DEVX_RUN"]);
    expect(client.editMessage).toHaveBeenCalledWith("tech-team", "R1", "M1", "e");
    expect(client.react).toHaveBeenCalledWith("tech-team", "M1", undefined, "✅", true);
    expect(TEAM_CHAT_TOOLS).toHaveLength(9);
  });
});

describe("runTool", () => {
  it("returns the status and body as text, flagging a non-2xx as an error", async () => {
    const client = fakeClient();
    const success = await runTool(byName("list_channels"), client as unknown as TeamChatClient, {});
    expect(success).toEqual({ content: [{ type: "text", text: JSON.stringify(ok) }] });
    client.listChannels.mockResolvedValueOnce({ status: 403, body: { message: "Forbidden" } });
    expect((await runTool(byName("list_channels"), client as unknown as TeamChatClient, {})).isError).toBe(true);
  });

  it("returns a thrown error as an error result", async () => {
    const client = fakeClient();
    client.listChannels.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce("weird");
    expect(await runTool(byName("list_channels"), client as unknown as TeamChatClient, {})).toEqual({ content: [{ type: "text", text: JSON.stringify({ error: "offline" }) }], isError: true });
    expect((await runTool(byName("list_channels"), client as unknown as TeamChatClient, {})).content[0]).toEqual({ type: "text", text: JSON.stringify({ error: "weird" }) });
  });
});

describe("server", () => {
  it("registers every tool, and each registration runs its tool", async () => {
    const client = fakeClient();
    const server = createTeamChatMcpServer(client as unknown as TeamChatClient) as unknown as { registerTool: ReturnType<typeof vi.fn> };
    expect(server.registerTool).toHaveBeenCalledTimes(9);
    const [name, , handler] = server.registerTool.mock.calls[0] as [string, unknown, (args: Record<string, unknown>) => Promise<unknown>];
    expect(name).toBe("list_channels");
    await handler({});
    expect(client.listChannels).toHaveBeenCalledOnce();
  });

  it("starts on stdio from a valid environment and refuses an invalid one", async () => {
    const server = (await main({ TEAM_CHAT_API_URL: "https://chat.example.com", TEAM_CHAT_ID_TOKEN: "a", TEAM_CHAT_REFRESH_TOKEN: "b", TEAM_CHAT_CLIENT_ID: "c", TEAM_CHAT_REGION: "us-east-1" })) as unknown as { connect: ReturnType<typeof vi.fn> };
    expect(server.connect).toHaveBeenCalledOnce();
    expect(console.log).toBe(console.error);
    await expect(main({})).rejects.toThrow();
  });

  it("starts only as the entry point, exiting 1 when startup fails", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    await startIfEntryPoint(["node", "vitest"], {});
    expect(exit).not.toHaveBeenCalled();
    await startIfEntryPoint(["node", "teamChatMcpServer.ts"], {});
    expect(exit).toHaveBeenCalledWith(1);
    await startIfEntryPoint(["node", "teamChatMcpServer.ts"], { TEAM_CHAT_API_URL: "https://chat.example.com", TEAM_CHAT_ID_TOKEN: "a", TEAM_CHAT_REFRESH_TOKEN: "b", TEAM_CHAT_CLIENT_ID: "c", TEAM_CHAT_REGION: "us-east-1" });
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("knows when it's the entry point", () => {
    expect(isEntryPoint(["node", "/repo/backend/controller/mcp/teamChatMcpServer.ts"])).toBe(true);
    expect(isEntryPoint(["node", "/repo/node_modules/vitest/vitest.mjs"])).toBe(false);
    expect(isEntryPoint(["node"])).toBe(false);
  });
});
