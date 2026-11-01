import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logError, logInfo } from "../../logger";
import { OpsClientConfigSchema } from "../../models/opsClientConfig";
import { BoroughSimOpsClient } from "../../service/opsClient/boroughSimOpsClient";
import { BOROUGH_SIM_OPS_TOOLS } from "./boroughSimOpsTools";
import { isEntryPoint, registerTools } from "./mcpTool";

/** The boroughsim-ops MCP server with every tool registered (docs/17-executive-team.md §12.4). */
export function createBoroughSimOpsMcpServer(client: BoroughSimOpsClient): McpServer {
  const server = new McpServer({ name: "boroughsim-ops", version: "1.0.0" });
  registerTools(server, BOROUGH_SIM_OPS_TOOLS, client);
  return server;
}

/** Entry point, run over stdio by Claude Code for one COO run. MCP owns stdout, so the logger's lines go to stderr. */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<McpServer> {
  console.log = console.error;
  const config = OpsClientConfigSchema.parse(env);
  const server = createBoroughSimOpsMcpServer(new BoroughSimOpsClient(config));
  await server.connect(new StdioServerTransport());
  logInfo("BoroughSimOpsMcpServerStarted", { apiUrl: config.BOROUGH_SIM_API_URL });
  return server;
}

/** Starts the server when run directly; on a startup failure, logs it and exits 1. */
export async function startIfEntryPoint(argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isEntryPoint("boroughSimOpsMcpServer", argv)) return;
  try {
    await main(env);
  } catch (err) {
    logError("BoroughSimOpsMcpServerFailed", { error: String(err) });
    process.exit(1);
  }
}

void startIfEntryPoint();
