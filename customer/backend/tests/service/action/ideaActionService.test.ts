import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResidentDao } from "../../../dao/resident/residentDao";
import type { ResidentIdeaDao } from "../../../dao/residentIdea/residentIdeaDao";
import { TerminalError } from "../../../models/errors";
import type { IdeaResolution, IdeaStep, ResidentFeatureRequestThread, ResidentIdea, ThreadWrite } from "../../../models/residentIdea";
import type { ModelTurn, ModelTurnRequest } from "../../../service/action/bedrockActionModel";
import { describeIdea, grantedTools, MAX_TURNS, rebuildMessages, runIdeaActions, type IdeaActionDeps } from "../../../service/action/ideaActionService";
import type { PublicApiReply, PublicApiRequest } from "../../../service/action/publicApiClient";
import { current, featureIdea, idea, searchStep } from "../../residentFixtures";

const NOW = new Date("2026-11-02T22:14:00.000Z");
const FR_ID = "01K8C4T1W7H3P9N2M6QZ8V0RJD";
const message = { persona_id: "hawthorn", idea_id: idea.idea_id };

function turn(name: string | null, input: Record<string, unknown> = {}, text: string | null = null): ModelTurn {
  return { toolUse: name ? { toolUseId: `t-${name}`, name, input } : null, text, inputTokens: 100, outputTokens: 10 };
}
const finish = (resolution = "SATISFIED", extra: Record<string, unknown> = {}) => turn("finish_idea", { resolution, summary: "Fine. Booked for Tuesday.", ...extra });

const searchReply: PublicApiReply = {
  status_code: 200,
  call_id: "01CALL",
  body: { items: [{ order_id: "01ORDER", status: "SCHEDULED", status_reason_description: null, scheduled_window: null, status_updated_at: "U" }], next_cursor: null },
};
const createReply: PublicApiReply = {
  status_code: 201,
  call_id: "01CALL2",
  body: { feature_request_id: FR_ID, status: "RECEIVED", status_reason_description: null, title: "Texts please" },
};
const filedThread: ResidentFeatureRequestThread = {
  persona_id: "hawthorn",
  sk: `FEATURE_REQUEST#${FR_ID}`,
  feature_request_id: FR_ID,
  title: "Texts please",
  filed_by_idea_id: idea.idea_id,
  last_known_status: "RECEIVED",
  last_known_status_reason: null,
  last_checked_at: NOW.toISOString(),
  created_at: NOW.toISOString(),
};

interface Saved {
  step: IdeaStep;
  resolution: IdeaResolution;
  writes: ThreadWrite[];
}

function setup(turns: ModelTurn[], options: { startIdea?: ResidentIdea; steps?: IdeaStep[]; threads?: ResidentFeatureRequestThread[][] } = {}) {
  const saved: Saved[] = [];
  const threadPages = [...(options.threads ?? [[]])];
  const ideaDao = {
    getIdeaWithSteps: vi.fn().mockResolvedValue({ idea: options.startIdea ?? idea, steps: options.steps ?? [] }),
    listFeatureRequestThreads: vi.fn(async () => (threadPages.length > 1 ? threadPages.shift() : threadPages[0]) ?? []),
    appendStep: vi.fn(async (step: IdeaStep, resolution: IdeaResolution, writes: ThreadWrite[] = []) => {
      saved.push({ step, resolution, writes });
    }),
  };
  const requests: ModelTurnRequest[] = [];
  const script = [...turns];
  const takeTurn = vi.fn(async (request: ModelTurnRequest) => {
    requests.push(structuredClone(request));
    return script.shift() ?? turn(null);
  });
  const call = vi.fn(async (request: PublicApiRequest) => (request.path.startsWith("/v1/requests") ? searchReply : createReply));
  const deps: IdeaActionDeps = {
    residentDao: { getCurrent: vi.fn().mockResolvedValue(current) } as unknown as ResidentDao,
    ideaDao: ideaDao as unknown as ResidentIdeaDao,
    takeTurn,
    call,
    now: () => NOW,
  };
  return { deps, saved, requests, ideaDao, call, takeTurn };
}

const toolNames = (request: ModelTurnRequest) => request.tools.map((tool) => tool.name);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("runIdeaActions", () => {
  it("lets the resident finish straight away, recording one FINISH step and the resolution", async () => {
    const { deps, saved, requests } = setup([finish("GAVE_UP", { follow_up: "Ask again Friday." })]);
    await expect(runIdeaActions(message, deps)).resolves.toEqual({ outcome: "FINISHED", status: "GAVE_UP", steps: 1 });

    expect(toolNames(requests[0])).toEqual(["SEARCH_REQUESTS", "CREATE_FEATURE_REQUEST", "finish_idea"]);
    expect(requests[0]).toMatchObject({ modelId: current.model_id, system: current.action_prompt });
    expect(requests[0].forceTool).toBeUndefined();
    expect(saved[0].step).toMatchObject({ sk: `${idea.sk}#STEP#0001`, sequence: 1, kind: "FINISH", execution: null, decision: { tool: "finish_idea" } });
    expect(saved[0].resolution).toEqual({
      status: "GAVE_UP",
      summary: "Fine. Booked for Tuesday.",
      follow_up: "Ask again Friday.",
      tools_used: [],
      step_count: 1,
      last_step_sequence: 1,
      started_at: NOW.toISOString(),
      finished_at: NOW.toISOString(),
      prompt_version: "idea-actioner@1",
      input_tokens: 100,
      output_tokens: 10,
    });
  });

  it("runs a tool, saves it with its memory before the next turn, and hands the result back to the model", async () => {
    const { deps, saved, requests, call } = setup([turn("SEARCH_REQUESTS", {}, "Let me look."), finish()]);
    await expect(runIdeaActions(message, deps)).resolves.toEqual({ outcome: "FINISHED", status: "SATISFIED", steps: 2 });

    expect(call).toHaveBeenCalledTimes(1);
    expect(saved[0].step).toMatchObject({ kind: "TOOL_CALL", sequence: 1, decision: { tool: "SEARCH_REQUESTS", model_text: "Let me look." }, execution: { status: "COMPLETED" } });
    expect(saved[0].resolution).toMatchObject({ status: "IN_PROGRESS", tools_used: ["SEARCH_REQUESTS"], last_step_sequence: 1, finished_at: null });
    expect(saved[0].writes).toEqual([{ kind: "ORDER_CHECKED", order_id: "01ORDER", status: "SCHEDULED", scheduled_window: null, at: NOW.toISOString() }]);
    expect(requests[1].messages).toHaveLength(3);
    expect(requests[1].messages[2].content?.[0].toolResult).toMatchObject({ toolUseId: "step1", status: "success" });
    expect(saved[1].resolution).toMatchObject({ status: "SATISFIED", step_count: 2, input_tokens: 200, tools_used: ["SEARCH_REQUESTS"] });
  });

  it("stops offering a tool at its cap", async () => {
    const { deps, requests } = setup([turn("SEARCH_REQUESTS"), turn("SEARCH_REQUESTS"), turn("SEARCH_REQUESTS"), finish()]);
    await runIdeaActions(message, deps);
    expect(toolNames(requests[3])).toEqual(["CREATE_FEATURE_REQUEST", "finish_idea"]);
  });

  it("offers GET_FEATURE_REQUEST once the resident has filed one, and forces finish_idea after five tool calls", async () => {
    const draft = { title: "Texts please", description: "Text me when work is booked." };
    const { deps, requests, saved } = setup(
      [turn("SEARCH_REQUESTS"), turn("SEARCH_REQUESTS"), turn("CREATE_FEATURE_REQUEST", draft), turn("GET_FEATURE_REQUEST", { feature_request_id: FR_ID }), turn("SEARCH_REQUESTS"), finish("UNSATISFIED")],
      { threads: [[], [filedThread]] }
    );
    await expect(runIdeaActions(message, deps)).resolves.toEqual({ outcome: "FINISHED", status: "UNSATISFIED", steps: 6 });
    expect(toolNames(requests[3])).toContain("GET_FEATURE_REQUEST");
    expect(saved[2].writes[0]).toMatchObject({ kind: "FEATURE_REQUEST_FILED", feature_request_id: FR_ID });
    expect(requests[5]).toMatchObject({ forceTool: "finish_idea" });
    expect(toolNames(requests[5])).toEqual(["finish_idea"]);
  });

  it("closes the idea as MAX_DEPTH_REACHED when the model never makes a usable turn", async () => {
    const { deps, saved, takeTurn, requests } = setup([]);
    await expect(runIdeaActions(message, deps)).resolves.toEqual({ outcome: "FINISHED", status: "MAX_DEPTH_REACHED", steps: 1 });
    expect(takeTurn).toHaveBeenCalledTimes(MAX_TURNS);
    expect(requests[MAX_TURNS - 1].forceTool).toBe("finish_idea");
    expect(saved[0].step).toMatchObject({ kind: "FORCED_FINISH", decision: null, execution: null, sequence: 1 });
    expect(saved[0].resolution).toMatchObject({ status: "MAX_DEPTH_REACHED", summary: null, finished_at: NOW.toISOString() });
  });

  it("treats a malformed finish or an unoffered tool as an unusable turn, and carries on", async () => {
    const { deps, saved } = setup([turn("finish_idea", { resolution: "THRILLED" }), turn("BROWSE_WEBSITE"), finish()]);
    await expect(runIdeaActions(message, deps)).resolves.toMatchObject({ status: "SATISFIED", steps: 1 });
    expect(saved).toHaveLength(1);
  });

  it("resumes a redelivered idea from its saved steps", async () => {
    const inProgress = { ...idea, resolution: { ...idea.resolution, status: "IN_PROGRESS" as const, step_count: 1, last_step_sequence: 1, started_at: "S", tools_used: ["SEARCH_REQUESTS"] } };
    const { deps, saved, requests } = setup([finish()], { startIdea: inProgress, steps: [searchStep] });
    await runIdeaActions(message, deps);
    expect(requests[0].messages).toHaveLength(3);
    expect(saved[0].step.sequence).toBe(2);
    expect(saved[0].resolution).toMatchObject({ started_at: "S", step_count: 2 });
  });

  it("skips an unknown resident or idea, a finished idea, and a resident with no tools", async () => {
    const base = setup([]);
    vi.mocked(base.deps.residentDao!.getCurrent).mockResolvedValueOnce(null);
    await expect(runIdeaActions(message, base.deps)).resolves.toEqual({ outcome: "SKIPPED_UNKNOWN_RESIDENT" });
    base.ideaDao.getIdeaWithSteps.mockResolvedValueOnce(null);
    await expect(runIdeaActions(message, base.deps)).resolves.toEqual({ outcome: "SKIPPED_UNKNOWN_IDEA" });
    base.ideaDao.getIdeaWithSteps.mockResolvedValueOnce({ idea: { ...idea, resolution: { ...idea.resolution, status: "SATISFIED" } }, steps: [] });
    await expect(runIdeaActions(message, base.deps)).resolves.toEqual({ outcome: "SKIPPED_ALREADY_FINISHED" });
    vi.mocked(base.deps.residentDao!.getCurrent).mockResolvedValueOnce({ ...current, action_buckets: ["WEBSITE"] });
    await expect(runIdeaActions(message, base.deps)).resolves.toEqual({ outcome: "SKIPPED_NO_TOOLS" });
    expect(base.takeTurn).not.toHaveBeenCalled();
  });

  it("stops when another delivery already wrote the step, and rethrows anything else", async () => {
    for (const script of [[finish()], [turn("SEARCH_REQUESTS")], []]) {
      const conflict = setup(script);
      conflict.ideaDao.appendStep.mockRejectedValueOnce(new TerminalError("conflict"));
      await expect(runIdeaActions(message, conflict.deps)).resolves.toEqual({ outcome: "STOPPED_CONFLICT" });
    }
    const broken = setup([finish()]);
    broken.ideaDao.appendStep.mockRejectedValueOnce(new Error("throttled"));
    await expect(runIdeaActions(message, broken.deps)).rejects.toThrow("throttled");
  });

  it("calls Bedrock and the public API itself when not given a model or a caller", async () => {
    const bedrockMock = mockClient(BedrockRuntimeClient);
    bedrockMock
      .on(ConverseCommand)
      .resolvesOnce({ output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "a", name: "SEARCH_REQUESTS", input: {} } }] } } })
      .resolvesOnce({ output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "b", name: "finish_idea", input: { resolution: "SATISFIED", summary: "Good." } } }] } } });
    const fetchFn = vi.fn().mockResolvedValue({ status: 200, text: async () => JSON.stringify(searchReply.body), headers: { get: () => "01CALL" } });
    vi.stubGlobal("fetch", fetchFn);
    vi.stubEnv("PUBLIC_API_BASE_URL", "https://public-api.boroughsim.com");
    const { deps, saved } = setup([]);
    try {
      await expect(runIdeaActions(message, { residentDao: deps.residentDao, ideaDao: deps.ideaDao, now: deps.now })).resolves.toMatchObject({ status: "SATISFIED" });
    } finally {
      vi.unstubAllGlobals();
      bedrockMock.restore();
    }
    expect(fetchFn.mock.calls[0][0]).toBe("https://public-api.boroughsim.com/v1/requests/search");
    expect(saved[0].step.execution?.response?.call_id).toBe("01CALL");
  });

  it("builds its own DAOs and clients from the environment", async () => {
    vi.stubEnv("RESIDENTS_TABLE_NAME", "");
    await expect(runIdeaActions(message)).rejects.toThrow("RESIDENTS_TABLE_NAME");
  });
});

describe("helpers", () => {
  it("describes an idea with its order and the resident's past feature requests", () => {
    const text = describeIdea(idea, [filedThread], NOW);
    expect(text).toContain("about BoroughSim order 01ORDER (311 complaint 69860415)");
    expect(text).toContain(`${FR_ID}: "Texts please", last seen RECEIVED`);
    expect(describeIdea(featureIdea, [], NOW)).toContain("not about any particular order");
    expect(describeIdea({ ...idea, external_unique_key: null }, [], NOW)).toContain("about BoroughSim order 01ORDER.");
  });

  it("rebuilds the conversation from tool steps only, marking failures as errors", () => {
    const failed: IdeaStep = { ...searchStep, sequence: 2, sk: `${idea.sk}#STEP#0002`, decision: { ...searchStep.decision!, model_text: null }, execution: { ...searchStep.execution!, status: "FAILED" } };
    const finished: IdeaStep = { ...searchStep, sequence: 3, kind: "FINISH", execution: null };
    const messages = rebuildMessages("go", [searchStep, failed, finished]);
    expect(messages).toHaveLength(5);
    expect(messages[1].content).toHaveLength(2);
    expect(messages[3].content).toHaveLength(1);
    expect(messages[4].content?.[0].toolResult?.status).toBe("error");
  });

  it("grants each bucket's tools that have a recipe", () => {
    expect(grantedTools(current).map((tool) => tool.name)).toEqual(["SEARCH_REQUESTS", "CREATE_FEATURE_REQUEST", "GET_FEATURE_REQUEST"]);
    expect(grantedTools({ ...current, action_buckets: [] })).toEqual([]);
  });
});
