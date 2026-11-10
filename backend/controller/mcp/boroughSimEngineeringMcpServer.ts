import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logError, logInfo } from "../../logger";
import { EngineeringClientConfigSchema } from "../../models/engineeringClientConfig";
import { BoroughSimEngineeringClient } from "../../service/engineeringClient/boroughSimEngineeringClient";
import { BOROUGH_SIM_ENGINEERING_TOOLS } from "./boroughSimEngineeringTools";
import { isEntryPoint, registerTools } from "./mcpTool";

/** The boroughsim-engineering MCP server with every tool registered (docs/17-executive-team.md §22.9). */
export function createBoroughSimEngineeringMcpServer(client: BoroughSimEngineeringClient): McpServer {
  const server = new McpServer({ name: "boroughsim-engineering", version: "1.0.0" });
  registerTools(server, BOROUGH_SIM_ENGINEERING_TOOLS, client);
  return server;
}

/** Entry point, run over stdio by Claude Code for one Software Engineer run. MCP owns stdout, so the logger's lines go to stderr. */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<McpServer> {
  console.log = console.error;
  const config = EngineeringClientConfigSchema.parse(env);
  const server = createBoroughSimEngineeringMcpServer(new BoroughSimEngineeringClient(config));
  await server.connect(new StdioServerTransport());
  logInfo("BoroughSimEngineeringMcpServerStarted", { apiUrl: config.BOROUGH_SIM_API_URL, queryLimit: config.ENGINEERING_QUERY_LIMIT });
  return server;
}

/** Starts the server when run directly; on a startup failure, logs it and exits 1. */
export async function startIfEntryPoint(argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isEntryPoint("boroughSimEngineeringMcpServer", argv)) return;
  try {
    await main(env);
  } catch (err) {
    logError("BoroughSimEngineeringMcpServerFailed", { error: String(err) });
    process.exit(1);
  }
}

void startIfEntryPoint();
