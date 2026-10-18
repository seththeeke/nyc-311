import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandOutput, type ToolConfiguration } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import { logInfo, logWarn } from "../../logger";
import { IDEA_TYPES, type IdeaType } from "../../models/resident";

/* "Not about any order" in the tool's order_id enum — a required choice is filled in more reliably than an optional field. */
export const NO_ORDER = "NONE";
/* Generous: a cap against runaway output, not a style limit (§3 Flow B decision 4). */
export const MAX_IDEA_LENGTH = 2000;
const MAX_TOKENS = 600;
const TEMPERATURE = 0.9;

export type GeneratorResult =
  | { kind: "IDEA"; ideaType: IdeaType; orderId: string | null; text: string; inputTokens: number; outputTokens: number }
  | { kind: "NOTHING_TO_SAY"; reason: string; inputTokens: number; outputTokens: number }
  | { kind: "UNUSABLE"; reason: string; inputTokens: number; outputTokens: number };

export interface GeneratorRequest {
  modelId: string;
  systemPrompt: string;
  userMessage: string;
  /** Orders the resident may name; anything else is unusable. */
  orderIds: string[];
}

const RecordIdeaInputSchema = z.object({
  idea_type: z.enum(IDEA_TYPES),
  order_id: z.string().min(1),
  text: z.string(),
});
const NothingToSayInputSchema = z.object({ reason: z.string().optional() });

function toolConfig(orderIds: string[]): ToolConfiguration {
  return {
    tools: [
      {
        toolSpec: {
          name: "record_idea",
          description: "Record the one thing you want from BoroughSim right now.",
          inputSchema: {
            json: {
              type: "object",
              properties: {
                idea_type: { type: "string", enum: [...IDEA_TYPES], description: "The kind of idea." },
                order_id: { type: "string", enum: [...orderIds, NO_ORDER], description: `The order it is about, or ${NO_ORDER}.` },
                text: { type: "string", description: "What you want and why, in your own voice." },
              },
              required: ["idea_type", "order_id", "text"],
            },
          },
        },
      },
      {
        toolSpec: {
          name: "nothing_to_say",
          description: "Nothing is worth raising right now.",
          inputSchema: { json: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] } },
        },
      },
    ],
    toolChoice: { any: {} },
  };
}

/* Constructed lazily (CLAUDE.md §5.2). */
function getBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({});
}

/**
 * One Converse call (§3 Flow B decisions 1-4): the resident's own prompt
 * and model, the context as the user turn, and two tools — record an idea
 * or say there is nothing to say. Bedrock errors, throttling included,
 * propagate so the schedule retries.
 */
export async function generateIdea(request: GeneratorRequest, client: BedrockRuntimeClient = getBedrockClient()): Promise<GeneratorResult> {
  logInfo("BedrockIdeaRequest", { modelId: request.modelId, orderIds: request.orderIds, userMessage: request.userMessage });
  const output: ConverseCommandOutput = await client.send(
    new ConverseCommand({
      modelId: request.modelId,
      system: [{ text: request.systemPrompt }],
      messages: [{ role: "user", content: [{ text: request.userMessage }] }],
      toolConfig: toolConfig(request.orderIds),
      inferenceConfig: { maxTokens: MAX_TOKENS, temperature: TEMPERATURE },
    })
  );
  const tokens = { inputTokens: output.usage?.inputTokens ?? 0, outputTokens: output.usage?.outputTokens ?? 0 };
  const content = output.output?.message?.content ?? [];
  logInfo("BedrockIdeaResponse", { modelId: request.modelId, stopReason: output.stopReason, content, ...tokens });

  const toolUse = content.find((block) => block.toolUse)?.toolUse;
  if (!toolUse) return { kind: "UNUSABLE", reason: "The model answered without using a tool", ...tokens };
  if (toolUse.name === "nothing_to_say") {
    const parsed = NothingToSayInputSchema.safeParse(toolUse.input);
    return { kind: "NOTHING_TO_SAY", reason: (parsed.success && parsed.data.reason) || "No reason given", ...tokens };
  }
  const parsed = RecordIdeaInputSchema.safeParse(toolUse.input);
  if (toolUse.name !== "record_idea" || !parsed.success) {
    logWarn("BedrockIdeaToolInputInvalid", { tool: toolUse.name, input: toolUse.input });
    return { kind: "UNUSABLE", reason: `Unusable tool call ${toolUse.name}`, ...tokens };
  }
  const text = parsed.data.text.trim();
  if (text.length === 0 || text.length > MAX_IDEA_LENGTH) return { kind: "UNUSABLE", reason: `Idea text length ${text.length}`, ...tokens };
  const orderId = parsed.data.order_id === NO_ORDER ? null : parsed.data.order_id;
  if (orderId !== null && !request.orderIds.includes(orderId)) return { kind: "UNUSABLE", reason: `Order ${orderId} was not offered`, ...tokens };
  return { kind: "IDEA", ideaType: parsed.data.idea_type, orderId, text, ...tokens };
}
