import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logError, logInfo } from "../../logger";
import { OpsClientConfigSchema } from "../../models/opsClientConfig";
import { BoroughSimProductClient } from "../../service/productClient/boroughSimProductClient";
import { BOROUGH_SIM_PRODUCT_TOOLS } from "./boroughSimProductTools";
import { isEntryPoint, registerTools } from "./mcpTool";

/** The boroughsim-product MCP server with every tool registered (docs/17-executive-team.md §17.2). */
export function createBoroughSimProductMcpServer(client: BoroughSimProductClient): McpServer {
  const server = new McpServer({ name: "boroughsim-product", version: "1.0.0" });
  registerTools(server, BOROUGH_SIM_PRODUCT_TOOLS, client);
  return server;
}

/** Entry point, run over stdio by Claude Code for one CPO run. MCP owns stdout, so the logger's lines go to stderr. */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<McpServer> {
  console.log = console.error;
  const config = OpsClientConfigSchema.parse(env);
  const server = createBoroughSimProductMcpServer(new BoroughSimProductClient(config));
  await server.connect(new StdioServerTransport());
  logInfo("BoroughSimProductMcpServerStarted", { apiUrl: config.BOROUGH_SIM_API_URL });
  return server;
}

/** Starts the server when run directly; on a startup failure, logs it and exits 1. */
export async function startIfEntryPoint(argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isEntryPoint("boroughSimProductMcpServer", argv)) return;
  try {
    await main(env);
  } catch (err) {
    logError("BoroughSimProductMcpServerFailed", { error: String(err) });
    process.exit(1);
  }
}

void startIfEntryPoint();
