import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z, ZodRawShape } from "zod";
import { logError, logInfo } from "../../logger";

/* What every agent MCP client call returns: the HTTP status and parsed body. */
export interface McpCallResult {
  status: number;
  body: unknown;
}

/**
 * One MCP tool (docs/17-executive-team.md §10.7): a controller in the
 * CLAUDE.md §5.2 sense. The SDK validates its input against `inputSchema`;
 * `run` calls the client service.
 */
export interface McpTool<TClient, TShape extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: TShape;
  /* Method syntax on purpose: it lets a tool with a specific shape sit in a list of tools. */
  run(client: TClient, args: z.objectOutputType<TShape, z.ZodTypeAny>): Promise<McpCallResult>;
}

/** Infers a tool's argument type from its own schema. */
export function defineTool<TClient>() {
  return <TShape extends ZodRawShape>(definition: McpTool<TClient, TShape>): McpTool<TClient, TShape> => definition;
}

/** A tool's result as MCP text content; a non-2xx status or a throw is an error result the agent can read. */
export async function runTool<TClient>(tool: McpTool<TClient>, client: TClient, args: Record<string, unknown>): Promise<CallToolResult> {
  logInfo("McpToolInvoked", { tool: tool.name, args });
  try {
    const result = await tool.run(client, args);
    const ok = result.status >= 200 && result.status < 300;
    logInfo("McpToolCompleted", { tool: tool.name, status: result.status });
    return { content: [{ type: "text", text: JSON.stringify({ status: result.status, body: result.body }) }], ...(ok ? {} : { isError: true }) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("McpToolFailed", { tool: tool.name, error: message });
    return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
  }
}

/** Registers every tool on the server against one client. */
export function registerTools<TClient>(server: McpServer, tools: readonly McpTool<TClient>[], client: TClient): void {
  for (const tool of tools) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputSchema }, (args) => runTool(tool, client, args));
  }
}

/** True when argv[1] is the named server file (tsx loads it as an ES module, where require.main doesn't exist). */
export function isEntryPoint(fileStem: string, argv: readonly string[] = process.argv): boolean {
  return new RegExp(`${fileStem}\\.[cm]?[jt]s$`).test(argv[1] ?? "");
}
