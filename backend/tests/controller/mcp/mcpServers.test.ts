import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as opsServer from "../../../controller/mcp/boroughSimOpsMcpServer";
import { BOROUGH_SIM_OPS_TOOLS } from "../../../controller/mcp/boroughSimOpsTools";
import * as productServer from "../../../controller/mcp/boroughSimProductMcpServer";
import { BOROUGH_SIM_PRODUCT_TOOLS } from "../../../controller/mcp/boroughSimProductTools";
import * as engineeringServer from "../../../controller/mcp/boroughSimEngineeringMcpServer";
import { BOROUGH_SIM_ENGINEERING_TOOLS } from "../../../controller/mcp/boroughSimEngineeringTools";
import type { BoroughSimEngineeringClient } from "../../../service/engineeringClient/boroughSimEngineeringClient";
import type { BoroughSimProductClient } from "../../../service/productClient/boroughSimProductClient";
import { defineTool, isEntryPoint, runTool, type McpTool } from "../../../controller/mcp/mcpTool";
import * as chatServer from "../../../controller/mcp/teamChatMcpServer";
import { TEAM_CHAT_TOOLS } from "../../../controller/mcp/teamChatTools";
import type { BoroughSimOpsClient } from "../../../service/opsClient/boroughSimOpsClient";
import type { TeamChatClient } from "../../../service/teamChatClient/teamChatClient";

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({ StdioServerTransport: class {} }));
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool = vi.fn();
    connect = vi.fn().mockResolvedValue(undefined);
  },
}));

const ok = { status: 200, body: { items: [] } };
const fake = (names: string[]): Record<string, ReturnType<typeof vi.fn>> => Object.fromEntries(names.map((name) => [name, vi.fn().mockResolvedValue(ok)]));
const CHAT_ENV = { TEAM_CHAT_API_URL: "https://chat.example.com", TEAM_CHAT_ID_TOKEN: "a", TEAM_CHAT_REFRESH_TOKEN: "b", TEAM_CHAT_CLIENT_ID: "c", TEAM_CHAT_REGION: "us-east-1" };
const OPS_ENV = { BOROUGH_SIM_API_URL: "https://api.example.com", AGENT_ID_TOKEN: "a", AGENT_REFRESH_TOKEN: "b", AGENT_CLIENT_ID: "c", AGENT_REGION: "us-east-1" };
const originalLog = console.log;

function byName<T>(tools: readonly McpTool<T>[], name: string): McpTool<T> {
  const found = tools.find((tool) => tool.name === name);
  if (!found) throw new Error(name);
  return found;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  console.log = originalLog;
  vi.restoreAllMocks();
});

describe("team-chat tools", () => {
  it("map each tool's arguments onto the client", async () => {
    const client = fake(["listChannels", "readChannel", "readThread", "readInbox", "markInboxRead", "postMessage", "reply", "editMessage", "react"]);
    const c = client as unknown as TeamChatClient;
    const t = (name: string) => byName(TEAM_CHAT_TOOLS, name);
    await t("list_channels").run(c, {});
    await t("read_channel").run(c, { channel_id: "tech-team", after: "M1" });
    await t("read_thread").run(c, { channel_id: "tech-team", message_id: "M1" });
    await t("read_inbox").run(c, { limit: 5 });
    await t("mark_inbox_read").run(c, { entry_id: "E1" });
    await t("post_message").run(c, { channel_id: "tech-team", text: "hi", tags: ["DEVX_RUN"] });
    await t("reply").run(c, { channel_id: "tech-team", message_id: "M1", text: "re", tags: [] });
    await t("edit_message").run(c, { channel_id: "tech-team", message_id: "R1", thread_id: "M1", text: "e" });
    await t("react").run(c, { channel_id: "tech-team", message_id: "M1", emoji: "✅", remove: true });
    expect(client.readChannel).toHaveBeenCalledWith("tech-team", { after: "M1", before: undefined, limit: undefined });
    expect(client.postMessage).toHaveBeenCalledWith("tech-team", "hi", ["DEVX_RUN"]);
    expect(client.editMessage).toHaveBeenCalledWith("tech-team", "R1", "M1", "e");
    expect(client.react).toHaveBeenCalledWith("tech-team", "M1", undefined, "✅", true);
    expect(TEAM_CHAT_TOOLS).toHaveLength(9);
  });

  it("refuses an untagged top-level post, but not an untagged reply", () => {
    const post = z.object(byName(TEAM_CHAT_TOOLS, "post_message").inputSchema);
    expect(post.safeParse({ channel_id: "executive-assistant", text: "brief" }).success).toBe(false);
    expect(post.safeParse({ channel_id: "executive-assistant", text: "brief", tags: [] }).success).toBe(false);
    expect(post.safeParse({ channel_id: "executive-assistant", text: "brief", tags: ["DAILY_BRIEF"] }).success).toBe(true);
    expect(z.object(byName(TEAM_CHAT_TOOLS, "reply").inputSchema).safeParse({ channel_id: "tech-team", message_id: "M1", text: "re" }).success).toBe(true);
  });
});

describe("boroughsim-ops tools", () => {
  it("map each tool's arguments onto the client", async () => {
    const client = fake(["getCapacitySnapshot", "recruitOperator", "releaseOperator"]);
    const c = client as unknown as BoroughSimOpsClient;
    await byName(BOROUGH_SIM_OPS_TOOLS, "get_capacity_snapshot").run(c, {});
    await byName(BOROUGH_SIM_OPS_TOOLS, "recruit_operator").run(c, { name: "Truck 14", reason: "Median 2.6 days" });
    await byName(BOROUGH_SIM_OPS_TOOLS, "release_operator").run(c, { operator_id: "01A", reason: "Idle 3 days" });
    expect(client.recruitOperator).toHaveBeenCalledWith("Truck 14", "Median 2.6 days");
    expect(client.releaseOperator).toHaveBeenCalledWith("01A", "Idle 3 days");
  });
});

describe("boroughsim-product tools", () => {
  it("map each tool's arguments onto the client, with no capacity tool", async () => {
    const client = fake(["listContacts", "updateContact", "getWbr", "runQuery"]);
    const c = client as unknown as BoroughSimProductClient;
    await byName(BOROUGH_SIM_PRODUCT_TOOLS, "list_contacts").run(c, { status: "RECEIVED" });
    await byName(BOROUGH_SIM_PRODUCT_TOOLS, "track_contact").run(c, { contact_id: "C1", ticket_number: 170, status_reason_description: "Ticket #170." });
    await byName(BOROUGH_SIM_PRODUCT_TOOLS, "close_contact").run(c, { contact_id: "C2", closure_reason_code: "DUPLICATE", status_reason_description: "Same as #170." });
    await byName(BOROUGH_SIM_PRODUCT_TOOLS, "get_wbr").run(c, { weeks: 4 });
    await byName(BOROUGH_SIM_PRODUCT_TOOLS, "run_query").run(c, { sql: "SELECT 1" });
    expect(client.listContacts).toHaveBeenCalledWith({ status: "RECEIVED" });
    expect(client.updateContact).toHaveBeenCalledWith({ contact_id: "C1", ticket_number: 170, status_reason_description: "Ticket #170.", status: "IN_PROGRESS" });
    expect(client.updateContact).toHaveBeenCalledWith({ contact_id: "C2", closure_reason_code: "DUPLICATE", status_reason_description: "Same as #170.", status: "CLOSED" });
    expect(client.getWbr).toHaveBeenCalledWith(4);
    expect(client.runQuery).toHaveBeenCalledWith("SELECT 1");
    expect(BOROUGH_SIM_PRODUCT_TOOLS.map((t) => t.name).some((name) => /capacity|recruit|release/.test(name))).toBe(false);
  });
});

describe("boroughsim-engineering tools", () => {
  it("map each tool's arguments onto the client, with no capacity or contact tool", async () => {
    const client = fake(["runQuery", "getFlag"]);
    const c = client as unknown as BoroughSimEngineeringClient;
    await byName(BOROUGH_SIM_ENGINEERING_TOOLS, "run_query").run(c, { sql: "SELECT 1" });
    await byName(BOROUGH_SIM_ENGINEERING_TOOLS, "get_flag").run(c, { flag_key: "BACKEND_FLAG_READS" });
    expect(client.runQuery).toHaveBeenCalledWith("SELECT 1");
    expect(client.getFlag).toHaveBeenCalledWith("BACKEND_FLAG_READS");
    expect(BOROUGH_SIM_ENGINEERING_TOOLS.map((t) => t.name).some((name) => /capacity|recruit|release|contact/.test(name))).toBe(false);
  });

  it("refuses a flag key that isn't ALL_CAPS", () => {
    const getFlag = z.object(byName(BOROUGH_SIM_ENGINEERING_TOOLS, "get_flag").inputSchema);
    expect(getFlag.safeParse({ flag_key: "../admin" }).success).toBe(false);
  });
});

describe("runTool", () => {
  const listTool = defineTool<{ list: () => Promise<{ status: number; body: unknown }> }>()({ name: "list", description: "d", inputSchema: {}, run: (client) => client.list() });

  it("returns status and body as text, flagging a non-2xx or a throw as an error", async () => {
    const list = vi.fn().mockResolvedValueOnce(ok).mockResolvedValueOnce({ status: 409, body: { message: "limit" } }).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce("weird");
    expect(await runTool(listTool, { list }, {})).toEqual({ content: [{ type: "text", text: JSON.stringify(ok) }] });
    expect((await runTool(listTool, { list }, {})).isError).toBe(true);
    expect(await runTool(listTool, { list }, {})).toEqual({ content: [{ type: "text", text: JSON.stringify({ error: "offline" }) }], isError: true });
    expect((await runTool(listTool, { list }, {})).content[0]).toEqual({ type: "text", text: JSON.stringify({ error: "weird" }) });
  });

  it("knows when a server file is the entry point", () => {
    expect(isEntryPoint("teamChatMcpServer", ["node", "/repo/backend/controller/mcp/teamChatMcpServer.ts"])).toBe(true);
    expect(isEntryPoint("teamChatMcpServer", ["node", "vitest.mjs"])).toBe(false);
    expect(isEntryPoint("teamChatMcpServer", ["node"])).toBe(false);
  });
});

describe.each([
  ["team-chat", chatServer, CHAT_ENV, "teamChatMcpServer.ts", 9, () => chatServer.createTeamChatMcpServer(fake(["listChannels"]) as unknown as TeamChatClient)],
  ["boroughsim-ops", opsServer, OPS_ENV, "boroughSimOpsMcpServer.ts", 3, () => opsServer.createBoroughSimOpsMcpServer(fake(["getCapacitySnapshot"]) as unknown as BoroughSimOpsClient)],
  ["boroughsim-product", productServer, OPS_ENV, "boroughSimProductMcpServer.ts", 5, () => productServer.createBoroughSimProductMcpServer(fake(["listContacts"]) as unknown as BoroughSimProductClient)],
  ["boroughsim-engineering", engineeringServer, OPS_ENV, "boroughSimEngineeringMcpServer.ts", 2, () => engineeringServer.createBoroughSimEngineeringMcpServer(fake(["runQuery"]) as unknown as BoroughSimEngineeringClient)],
] as const)("the %s server", (_name, server, env, file, toolCount, create) => {
  it("registers every tool, each running its tool", async () => {
    const created = create() as unknown as { registerTool: ReturnType<typeof vi.fn> };
    expect(created.registerTool).toHaveBeenCalledTimes(toolCount);
    const handler = created.registerTool.mock.calls[0][2] as (args: Record<string, unknown>) => Promise<unknown>;
    await expect(handler({})).resolves.toMatchObject({ content: [{ type: "text" }] });
  });

  it("starts on stdio from a valid environment, sending logs to stderr, and refuses an invalid one", async () => {
    const started = (await server.main(env)) as unknown as { connect: ReturnType<typeof vi.fn> };
    expect(started.connect).toHaveBeenCalledOnce();
    expect(console.log).toBe(console.error);
    await expect(server.main({})).rejects.toThrow();
  });

  it("starts only as the entry point, exiting 1 when startup fails", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    await server.startIfEntryPoint(["node", "vitest"], {});
    expect(exit).not.toHaveBeenCalled();
    await server.startIfEntryPoint(["node", file], {});
    expect(exit).toHaveBeenCalledWith(1);
    await server.startIfEntryPoint(["node", file], env);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
