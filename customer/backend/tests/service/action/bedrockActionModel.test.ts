import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { takeModelTurn, type ModelTurnRequest } from "../../../service/action/bedrockActionModel";

const bedrockMock = mockClient(BedrockRuntimeClient);
const request: ModelTurnRequest = {
  modelId: "amazon.nova-micro-v1:0",
  system: "You are Hawthorn.",
  messages: [{ role: "user", content: [{ text: "Your idea" }] }],
  tools: [{ name: "SEARCH_REQUESTS", description: "Look it up", inputSchema: { type: "object", properties: {} } }],
};

beforeEach(() => {
  bedrockMock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("takeModelTurn", () => {
  it("offers the tools, requires one of them, and returns the tool call, text and tokens", async () => {
    bedrockMock.on(ConverseCommand).resolves({
      stopReason: "tool_use",
      output: { message: { role: "assistant", content: [{ text: " Let me look. " }, { toolUse: { toolUseId: "t1", name: "SEARCH_REQUESTS", input: {} } }] } },
      usage: { inputTokens: 900, outputTokens: 40, totalTokens: 940 },
    });
    await expect(takeModelTurn(request, new BedrockRuntimeClient({}))).resolves.toEqual({
      toolUse: { toolUseId: "t1", name: "SEARCH_REQUESTS", input: {} },
      text: "Let me look.",
      inputTokens: 900,
      outputTokens: 40,
    });
    const input = bedrockMock.commandCalls(ConverseCommand)[0].args[0].input;
    expect(input.toolConfig?.toolChoice).toEqual({ any: {} });
    expect(input.toolConfig?.tools?.[0].toolSpec?.name).toBe("SEARCH_REQUESTS");
    expect(input.system).toEqual([{ text: "You are Hawthorn." }]);
  });

  it("forces a named tool, and copes with an empty answer", async () => {
    bedrockMock.on(ConverseCommand).resolves({});
    await expect(takeModelTurn({ ...request, forceTool: "finish_idea" }, new BedrockRuntimeClient({}))).resolves.toEqual({
      toolUse: null,
      text: null,
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(bedrockMock.commandCalls(ConverseCommand)[0].args[0].input.toolConfig?.toolChoice).toEqual({ tool: { name: "finish_idea" } });
  });

  it("treats a tool call without an id, or without input, sensibly", async () => {
    bedrockMock
      .on(ConverseCommand)
      .resolvesOnce({ output: { message: { role: "assistant", content: [{ toolUse: { name: "X", input: {} } as never }] } } })
      .resolvesOnce({ output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "t", name: "X" } as never }] } } });
    expect((await takeModelTurn(request)).toolUse).toBeNull();
    expect((await takeModelTurn(request)).toolUse).toEqual({ toolUseId: "t", name: "X", input: {} });
  });
});
