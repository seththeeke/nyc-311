import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResidentDao } from "../../../dao/resident/residentDao";
import type { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";
import type { WebhookCustomerFacingOrderDao } from "../../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import type { GeneratorResult } from "../../../service/idea/bedrockIdeaGenerator";
import { runIdeaWorker, type IdeaWorkerDeps } from "../../../service/idea/ideaGenerationService";
import { current, order } from "../../residentFixtures";

const NOW = new Date("2026-10-17T14:00:00.000Z");
const tokens = { inputTokens: 600, outputTokens: 50 };

function setup(result: GeneratorResult, resident: typeof current | null = current, roll = 0.1) {
  const residentDao = { getCurrent: vi.fn().mockResolvedValue(resident) };
  const ideaDao = {
    listThreads: vi.fn().mockResolvedValue([]),
    listForResident: vi.fn().mockResolvedValue({ items: [], lastKey: null }),
    recordIdea: vi.fn().mockResolvedValue(undefined),
  };
  const orderDao = { sampleOpenOrders: vi.fn().mockResolvedValue([order("FRESH")]), batchGetOrders: vi.fn().mockResolvedValue([]) };
  const generate = vi.fn().mockResolvedValue(result);
  const deps: IdeaWorkerDeps = {
    residentDao: residentDao as unknown as ResidentDao,
    ideaDao: ideaDao as unknown as ResidentIdeaDao,
    orderDao: orderDao as unknown as WebhookCustomerFacingOrderDao,
    generate,
    random: () => roll,
    now: () => NOW,
  };
  return { deps, ideaDao, generate };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("runIdeaWorker", () => {
  it("records the model's idea with its order, version, model and no actions", async () => {
    const { deps, ideaDao, generate } = setup({ kind: "IDEA", ideaType: "ETA_REQUEST", orderId: "FRESH", text: "When?", ...tokens });
    const result = await runIdeaWorker({ persona_id: "hawthorn" }, deps);
    expect(result).toMatchObject({ outcome: "CREATED" });
    expect(generate.mock.calls[0][0]).toMatchObject({ modelId: current.model_id, systemPrompt: current.idea_prompt, orderIds: ["FRESH"] });
    const idea = ideaDao.recordIdea.mock.calls[0][0];
    expect(idea).toMatchObject({
      persona_id: "hawthorn",
      persona_version: 3,
      idea_type: "ETA_REQUEST",
      order_id: "FRESH",
      external_unique_key: "69860415",
      by_order_pk: "hawthorn#FRESH",
      feed_pk: "ALL",
      resident_pk: "hawthorn",
      actions: [],
      input_tokens: 600,
      created_at: NOW.toISOString(),
    });
    expect(idea.sk).toBe(`IDEA#${idea.idea_id}`);
  });

  it("records an idea about no order without order keys", async () => {
    const { deps, ideaDao } = setup({ kind: "IDEA", ideaType: "FEATURE_REQUEST", orderId: null, text: "Text me.", ...tokens });
    await runIdeaWorker({ persona_id: "hawthorn" }, deps);
    const idea = ideaDao.recordIdea.mock.calls[0][0];
    expect(idea).toMatchObject({ order_id: null, external_unique_key: null });
    expect(idea).not.toHaveProperty("by_order_pk");
  });

  it("skips when the roll misses, unless forced", async () => {
    const missed = setup({ kind: "NOTHING_TO_SAY", reason: "x", ...tokens }, current, 0.9);
    await expect(runIdeaWorker({ persona_id: "hawthorn" }, missed.deps)).resolves.toEqual({ outcome: "SKIPPED_ROLL" });
    expect(missed.generate).not.toHaveBeenCalled();
    await expect(runIdeaWorker({ persona_id: "hawthorn", force: true }, missed.deps)).resolves.toEqual({ outcome: "SKIPPED_NOTHING_TO_SAY" });
  });

  it("skips an unknown resident and unusable output", async () => {
    await expect(runIdeaWorker({ persona_id: "nobody" }, setup({ kind: "UNUSABLE", reason: "x", ...tokens }, null).deps)).resolves.toEqual({
      outcome: "SKIPPED_UNKNOWN_RESIDENT",
    });
    const unusable = setup({ kind: "UNUSABLE", reason: "x", ...tokens });
    await expect(runIdeaWorker({ persona_id: "hawthorn" }, unusable.deps)).resolves.toEqual({ outcome: "SKIPPED_UNUSABLE" });
    expect(unusable.ideaDao.recordIdea).not.toHaveBeenCalled();
  });

  it("builds its own clients from the environment", async () => {
    vi.stubEnv("RESIDENTS_TABLE_NAME", "");
    await expect(runIdeaWorker({ persona_id: "hawthorn" })).rejects.toThrow("RESIDENTS_TABLE_NAME");
    const { deps } = setup({ kind: "NOTHING_TO_SAY", reason: "x", ...tokens });
    vi.stubEnv("RESIDENT_IDEAS_TABLE_NAME", "");
    await expect(runIdeaWorker({ persona_id: "hawthorn" }, { ...deps, ideaDao: undefined })).rejects.toThrow("RESIDENT_IDEAS_TABLE_NAME");
  });

  it("asks Bedrock itself when no generator is given, at the current time", async () => {
    const bedrockMock = mockClient(BedrockRuntimeClient);
    bedrockMock.on(ConverseCommand).resolves({
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "t", name: "nothing_to_say", input: { reason: "quiet" } } }] } },
    });
    const { deps } = setup({ kind: "IDEA", ideaType: "ETA_REQUEST", orderId: null, text: "unused", ...tokens });
    await expect(runIdeaWorker({ persona_id: "hawthorn" }, { ...deps, generate: undefined, now: undefined })).resolves.toEqual({
      outcome: "SKIPPED_NOTHING_TO_SAY",
    });
    expect(bedrockMock.commandCalls(ConverseCommand)[0].args[0].input.modelId).toBe(current.model_id);
    bedrockMock.restore();
  });
});

