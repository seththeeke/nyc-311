import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logError, logInfo } from "../../logger";
import { TeamChatClientConfigSchema } from "../../models/teamChatClientConfig";
import { TeamChatClient } from "../../service/teamChatClient/teamChatClient";
import { TEAM_CHAT_TOOLS, type TeamChatTool } from "./teamChatTools";

/** The tool's result as MCP text content; a non-2xx status is an error result the agent can read. */
export async function runTool(tool: TeamChatTool, client: TeamChatClient, args: Record<string, unknown>): Promise<CallToolResult> {
  logInfo("TeamChatMcpToolInvoked", { tool: tool.name, args });
  try {
    const result = await tool.run(client, args);
    const ok = result.status >= 200 && result.status < 300;
    logInfo("TeamChatMcpToolCompleted", { tool: tool.name, status: result.status });
    return { content: [{ type: "text", text: JSON.stringify({ status: result.status, body: result.body }) }], ...(ok ? {} : { isError: true }) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("TeamChatMcpToolFailed", { tool: tool.name, error: message });
    return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
  }
}

/** The team-chat MCP server with every tool registered (docs/17-executive-team.md §10.7). */
export function createTeamChatMcpServer(client: TeamChatClient): McpServer {
  const server = new McpServer({ name: "team-chat", version: "1.0.0" });
  for (const tool of TEAM_CHAT_TOOLS as TeamChatTool[]) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputSchema }, (args) => runTool(tool, client, args));
  }
  return server;
}

/**
 * Entry point, run over stdio by Claude Code for one scheduled agent run.
 * MCP owns stdout, so the logger's lines go to stderr.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<McpServer> {
  console.log = console.error;
  const config = TeamChatClientConfigSchema.parse(env);
  const server = createTeamChatMcpServer(new TeamChatClient(config));
  await server.connect(new StdioServerTransport());
  logInfo("TeamChatMcpServerStarted", { apiUrl: config.TEAM_CHAT_API_URL });
  return server;
}

/* Run directly (tsx loads it as an ES module, where require.main doesn't exist); a test import doesn't start it. */
export function isEntryPoint(argv: readonly string[] = process.argv): boolean {
  return /teamChatMcpServer\.[cm]?[jt]s$/.test(argv[1] ?? "");
}

/** Starts the server when run directly; on a startup failure, logs it and exits 1 so Claude Code reports the server down. */
export async function startIfEntryPoint(argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isEntryPoint(argv)) return;
  try {
    await main(env);
  } catch (err) {
    logError("TeamChatMcpServerFailed", { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  }
}

void startIfEntryPoint();
