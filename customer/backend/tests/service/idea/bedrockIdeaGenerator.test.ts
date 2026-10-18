import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_IDEA_LENGTH, NO_ORDER, generateIdea } from "../../../service/idea/bedrockIdeaGenerator";

const bedrockMock = mockClient(BedrockRuntimeClient);
const request = { modelId: "amazon.nova-micro-v1:0", systemPrompt: "You are Hawthorn.", userMessage: "Orders near you", orderIds: ["01ORDER"] };
const usage = { inputTokens: 500, outputTokens: 40, totalTokens: 540 };

function replyWith(name: string, input: unknown) {
  bedrockMock.on(ConverseCommand).resolves({
    stopReason: "tool_use",
    usage,
    output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "t1", name, input: input as never } }] } },
  });
}

beforeEach(() => {
  bedrockMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("generateIdea", () => {
  it("sends the resident's model, prompt and both tools, forcing one tool", async () => {
    replyWith("record_idea", { idea_type: "ETA_REQUEST", order_id: "01ORDER", text: "  When?  " });
    await expect(generateIdea(request, new BedrockRuntimeClient({}))).resolves.toEqual({
      kind: "IDEA",
      ideaType: "ETA_REQUEST",
      orderId: "01ORDER",
      text: "When?",
      inputTokens: 500,
      outputTokens: 40,
    });
    const input = bedrockMock.commandCalls(ConverseCommand)[0].args[0].input;
    expect(input.modelId).toBe("amazon.nova-micro-v1:0");
    expect(input.system).toEqual([{ text: "You are Hawthorn." }]);
    expect(input.toolConfig?.toolChoice).toEqual({ any: {} });
    expect(JSON.stringify(input.toolConfig)).toContain(`"enum":["01ORDER","${NO_ORDER}"]`);
  });

  it("reads NONE as an idea about no order", async () => {
    replyWith("record_idea", { idea_type: "FEATURE_REQUEST", order_id: NO_ORDER, text: "Text me." });
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "IDEA", orderId: null });
  });

  it("passes nothing-to-say through, with or without a reason", async () => {
    replyWith("nothing_to_say", { reason: "All quiet." });
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "NOTHING_TO_SAY", reason: "All quiet." });
    replyWith("nothing_to_say", {});
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "NOTHING_TO_SAY", reason: "No reason given" });
  });

  it("calls anything else unusable", async () => {
    bedrockMock.on(ConverseCommand).resolves({ output: { message: { role: "assistant", content: [{ text: "Hi" }] } } });
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "UNUSABLE", inputTokens: 0 });
    replyWith("record_idea", { idea_type: "GOSSIP", order_id: "01ORDER", text: "x" });
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "UNUSABLE" });
    replyWith("record_idea", { idea_type: "ETA_REQUEST", order_id: "01ORDER", text: "   " });
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "UNUSABLE", reason: "Idea text length 0" });
    replyWith("record_idea", { idea_type: "ETA_REQUEST", order_id: "01ORDER", text: "x".repeat(MAX_IDEA_LENGTH + 1) });
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "UNUSABLE" });
    replyWith("record_idea", { idea_type: "ETA_REQUEST", order_id: "99OTHER", text: "When?" });
    await expect(generateIdea(request)).resolves.toMatchObject({ kind: "UNUSABLE", reason: "Order 99OTHER was not offered" });
  });

  it("lets Bedrock errors propagate so the schedule retries", async () => {
    bedrockMock.on(ConverseCommand).rejects(new Error("ThrottlingException"));
    await expect(generateIdea(request)).rejects.toThrow("ThrottlingException");
  });
});
