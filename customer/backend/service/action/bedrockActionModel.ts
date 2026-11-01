import { BedrockRuntimeClient, ConverseCommand, type Message, type Tool } from "@aws-sdk/client-bedrock-runtime";
import { logInfo } from "../../logger";

const MAX_TOKENS = 800;
const TEMPERATURE = 0.7;

export interface ModelTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelTurnRequest {
  modelId: string;
  system: string;
  messages: Message[];
  tools: ModelTool[];
  /* Forces this one tool; otherwise the model must use some tool. */
  forceTool?: string;
}

export interface ModelTurn {
  toolUse: { toolUseId: string; name: string; input: Record<string, unknown> } | null;
  /* Anything the model said alongside its tool call. */
  text: string | null;
  inputTokens: number;
  outputTokens: number;
}

/* Constructed lazily (CLAUDE.md §5.2). */
function getBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({});
}

/**
 * One turn of the action loop (docs/16 §5.2): the resident's model, the
 * conversation so far, and the tools on offer. Bedrock errors, throttling
 * included, propagate so the queue redelivers.
 */
export async function takeModelTurn(request: ModelTurnRequest, client: BedrockRuntimeClient = getBedrockClient()): Promise<ModelTurn> {
  const tools: Tool[] = request.tools.map((tool) => ({
    toolSpec: { name: tool.name, description: tool.description, inputSchema: { json: tool.inputSchema as never } },
  }));
  logInfo("BedrockActionRequest", { modelId: request.modelId, tools: request.tools.map((tool) => tool.name), forceTool: request.forceTool ?? null, turns: request.messages.length });
  const output = await client.send(
    new ConverseCommand({
      modelId: request.modelId,
      system: [{ text: request.system }],
      messages: request.messages,
      toolConfig: { tools, toolChoice: request.forceTool ? { tool: { name: request.forceTool } } : { any: {} } },
      inferenceConfig: { maxTokens: MAX_TOKENS, temperature: TEMPERATURE },
    })
  );
  const content = output.output?.message?.content ?? [];
  const toolUse = content.find((block) => block.toolUse)?.toolUse;
  const text = content.flatMap((block) => (block.text ? [block.text.trim()] : [])).filter((part) => part.length > 0).join("\n") || null;
  const turn: ModelTurn = {
    toolUse:
      toolUse && toolUse.toolUseId && toolUse.name
        ? { toolUseId: toolUse.toolUseId, name: toolUse.name, input: (toolUse.input ?? {}) as Record<string, unknown> }
        : null,
    text,
    inputTokens: output.usage?.inputTokens ?? 0,
    outputTokens: output.usage?.outputTokens ?? 0,
  };
  logInfo("BedrockActionResponse", { modelId: request.modelId, stopReason: output.stopReason, tool: turn.toolUse?.name ?? null, input: turn.toolUse?.input ?? null, text, inputTokens: turn.inputTokens, outputTokens: turn.outputTokens });
  return turn;
}
