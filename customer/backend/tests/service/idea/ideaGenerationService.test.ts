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
    listFeatureRequestThreads: vi.fn().mockResolvedValue([]),
    listForResident: vi.fn().mockResolvedValue({ items: [], lastKey: null }),
    recordIdea: vi.fn().mockResolvedValue(undefined),
  };
  const orderDao = { sampleOpenOrders: vi.fn().mockResolvedValue([order("FRESH")]), batchGetOrders: vi.fn().mockResolvedValue([]) };
  const generate = vi.fn().mockResolvedValue(result);
  const enqueueAction = vi.fn().mockResolvedValue(undefined);
  const deps: IdeaWorkerDeps = {
    enqueueAction,
    residentDao: residentDao as unknown as ResidentDao,
    ideaDao: ideaDao as unknown as ResidentIdeaDao,
    orderDao: orderDao as unknown as WebhookCustomerFacingOrderDao,
    generate,
    random: () => roll,
    now: () => NOW,
  };
  return { deps, ideaDao, generate, enqueueAction };
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
    const { deps, ideaDao, generate } = setup({ kind: "IDEA", ideaType: "ETA_REQUEST", orderId: "FRESH", featureRequestId: null, text: "When?", ...tokens });
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
      resolution: { status: "NOT_ACTIONED", last_step_sequence: 0 },
      input_tokens: 600,
      created_at: NOW.toISOString(),
    });
    expect(idea.sk).toBe(`IDEA#${idea.idea_id}`);
  });

  it("records an idea about no order without order keys", async () => {
    const { deps, ideaDao } = setup({ kind: "IDEA", ideaType: "FEATURE_REQUEST", orderId: null, featureRequestId: null, text: "Text me.", ...tokens });
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
    const { deps } = setup({ kind: "IDEA", ideaType: "ETA_REQUEST", orderId: null, featureRequestId: null, text: "unused", ...tokens });
    await expect(runIdeaWorker({ persona_id: "hawthorn" }, { ...deps, generate: undefined, now: undefined })).resolves.toEqual({
      outcome: "SKIPPED_NOTHING_TO_SAY",
    });
    expect(bedrockMock.commandCalls(ConverseCommand)[0].args[0].input.modelId).toBe(current.model_id);
    bedrockMock.restore();
  });

  it("queues a new idea for the action worker when the resident has tools (docs/16 §5.2)", async () => {
    const { deps, ideaDao, enqueueAction } = setup({ kind: "IDEA", ideaType: "ETA_REQUEST", orderId: "FRESH", featureRequestId: null, text: "When?", ...tokens });
    const result = await runIdeaWorker({ persona_id: "hawthorn" }, deps);
    const [idea] = ideaDao.recordIdea.mock.calls[0];
    expect(result).toEqual({ outcome: "CREATED", ideaId: idea.idea_id });
    expect(enqueueAction).toHaveBeenCalledWith({ persona_id: "hawthorn", idea_id: idea.idea_id });
  });

  it("queues nothing for a resident with no tools", async () => {
    const { deps, enqueueAction } = setup({ kind: "IDEA", ideaType: "ETA_REQUEST", orderId: "FRESH", featureRequestId: null, text: "When?", ...tokens }, { ...current, action_buckets: [] });
    await runIdeaWorker({ persona_id: "hawthorn" }, deps);
    expect(enqueueAction).not.toHaveBeenCalled();
  });

  it.each([new Error("sqs down"), "down"])("keeps the idea when the hand-off fails (%s)", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, enqueueAction } = setup({ kind: "IDEA", ideaType: "ETA_REQUEST", orderId: "FRESH", featureRequestId: null, text: "When?", ...tokens });
    enqueueAction.mockRejectedValue(failure);
    await expect(runIdeaWorker({ persona_id: "hawthorn" }, deps)).resolves.toMatchObject({ outcome: "CREATED" });
  });

  it("stores the feature request an idea follows up on (docs/16 §5.4)", async () => {
    const { deps, ideaDao, generate } = setup({ kind: "IDEA", ideaType: "STATUS_CHECK", orderId: null, featureRequestId: "01FR", text: "Any news?", ...tokens });
    vi.mocked(ideaDao.listThreads).mockResolvedValue([]);
    (ideaDao as unknown as { listFeatureRequestThreads: ReturnType<typeof vi.fn> }).listFeatureRequestThreads.mockResolvedValue([
      { persona_id: "hawthorn", sk: "FEATURE_REQUEST#01FR", feature_request_id: "01FR", title: "T", filed_by_idea_id: "I", last_known_status: "RECEIVED", last_known_status_reason: null, last_checked_at: "a", created_at: "a" },
    ]);
    await runIdeaWorker({ persona_id: "hawthorn" }, deps);
    expect(generate.mock.calls[0][0].featureRequestIds).toEqual(["01FR"]);
    expect(ideaDao.recordIdea.mock.calls[0][0]).toMatchObject({ feature_request_id: "01FR", order_id: null });
  });
});
