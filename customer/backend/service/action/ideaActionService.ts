import { BedrockRuntimeClient, type Message } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import { ResidentDao } from "../../dao/resident/residentDao";
import { ResidentIdeaDao } from "../../dao/residentIdea/residentIdeaDao";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { TerminalError } from "../../models/errors";
import type { IdeaActionMessage } from "../../models/ideaActionMessage";
import { ACTION_BUCKET_TOOLS, type ResidentCurrent } from "../../models/resident";
import {
  FINISHED_RESOLUTION_STATUSES,
  stepSortKey,
  type IdeaResolution,
  type IdeaStep,
  type ResidentFeatureRequestThread,
  type ResidentIdea,
  type ResolutionStatus,
} from "../../models/residentIdea";
import { ACTION_TOOLS, type ActionTool, type ToolContext } from "./actionTools";
import { takeModelTurn, type ModelTool, type ModelTurn, type ModelTurnRequest } from "./bedrockActionModel";
import { callPublicApi, type PublicApiReply, type PublicApiRequest } from "./publicApiClient";

/* Max depth (docs/16 §5.2): tool calls and model turns per idea. */
export const MAX_TOOL_CALLS = 5;
export const MAX_TURNS = 8;
export const FINISH_TOOL = "finish_idea";

const FinishInputSchema = z.object({
  resolution: z.enum(["SATISFIED", "UNSATISFIED", "GAVE_UP"]),
  summary: z.string().trim().min(1).max(1000),
  follow_up: z.string().trim().max(500).optional(),
});

const FINISH_TOOL_SPEC: ModelTool = {
  name: FINISH_TOOL,
  description: "You are done with this idea. Say how it went and, in your own voice, what you make of it.",
  inputSchema: {
    type: "object",
    properties: {
      resolution: { type: "string", enum: ["SATISFIED", "UNSATISFIED", "GAVE_UP"], description: "How it went for you." },
      summary: { type: "string", description: "A few sentences in your own voice." },
      follow_up: { type: "string", description: "What you would check later, if anything." },
    },
    required: ["resolution", "summary"],
  },
};

export type IdeaActionOutcome =
  | { outcome: "FINISHED"; status: ResolutionStatus; steps: number }
  | { outcome: "SKIPPED_UNKNOWN_RESIDENT" | "SKIPPED_UNKNOWN_IDEA" | "SKIPPED_ALREADY_FINISHED" | "SKIPPED_NO_TOOLS" | "STOPPED_CONFLICT" };

export interface IdeaActionDeps {
  residentDao?: ResidentDao;
  ideaDao?: ResidentIdeaDao;
  takeTurn?: (request: ModelTurnRequest) => Promise<ModelTurn>;
  call?: (request: PublicApiRequest) => Promise<PublicApiReply>;
  now?: () => Date;
}

/* The tools a resident has been granted that have a recipe. */
export function grantedTools(resident: ResidentCurrent): ActionTool[] {
  const names = [...new Set(resident.action_buckets.flatMap((bucket) => ACTION_BUCKET_TOOLS[bucket]))];
  return names.flatMap((name) => (ACTION_TOOLS[name] ? [ACTION_TOOLS[name] as ActionTool] : []));
}

/* The first user turn: the idea, its anchor, and what the resident already knows. */
export function describeIdea(idea: ResidentIdea, featureRequests: ResidentFeatureRequestThread[], now: Date): string {
  const lines = [
    `It is ${now.toISOString()}.`,
    `Your idea (${idea.idea_type}, ${idea.created_at}): ${idea.text}`,
    idea.order_id
      ? `It is about BoroughSim order ${idea.order_id}${idea.external_unique_key ? ` (311 complaint ${idea.external_unique_key})` : ""}.`
      : "It is not about any particular order.",
    ...(idea.feature_request_id ? [`It follows up your feature request ${idea.feature_request_id}; GET_FEATURE_REQUEST checks that one.`] : []),
  ];
  if (featureRequests.length > 0) {
    lines.push(
      `Feature requests you have filed before:\n${featureRequests
        .map((thread) => `- ${thread.feature_request_id}: "${thread.title}", last seen ${thread.last_known_status} on ${thread.last_checked_at}`)
        .join("\n")}`
    );
  }
  lines.push("What do you do?");
  return lines.join("\n");
}

/* One tool step as the model's tool call and the tool's result; any other step adds nothing to the conversation. */
export function stepMessages(step: IdeaStep): Message[] {
  if (step.kind !== "TOOL_CALL" || !step.decision || !step.execution) return [];
  const toolUseId = `step${step.sequence}`;
  return [
    {
      role: "assistant",
      content: [
        ...(step.decision.model_text ? [{ text: step.decision.model_text }] : []),
        { toolUse: { toolUseId, name: step.decision.tool, input: step.decision.input as never } },
      ],
    },
    {
      role: "user",
      content: [
        {
          toolResult: {
            toolUseId,
            status: step.execution.status === "COMPLETED" ? "success" : "error",
            content: [{ json: { summary: step.execution.summary, response: step.execution.response } as never }],
          },
        },
      ],
    },
  ];
}

/* The conversation so far, rebuilt from the stored steps, so a redelivered message resumes where it stopped. */
export function rebuildMessages(firstTurn: string, steps: IdeaStep[]): Message[] {
  return [{ role: "user", content: [{ text: firstTurn }] }, ...steps.flatMap(stepMessages)];
}

function nextResolution(previous: IdeaResolution, step: IdeaStep, resident: ResidentCurrent, now: string, finish?: { status: ResolutionStatus; summary: string | null; follow_up: string | null }): IdeaResolution {
  const tool = step.kind === "TOOL_CALL" && step.decision ? [step.decision.tool] : [];
  return {
    status: finish?.status ?? "IN_PROGRESS",
    summary: finish?.summary ?? previous.summary,
    follow_up: finish?.follow_up ?? previous.follow_up,
    tools_used: [...new Set([...previous.tools_used, ...tool])],
    step_count: previous.step_count + 1,
    last_step_sequence: step.sequence,
    started_at: previous.started_at ?? now,
    finished_at: finish ? now : null,
    prompt_version: resident.action_prompt_version,
    input_tokens: previous.input_tokens + step.input_tokens,
    output_tokens: previous.output_tokens + step.output_tokens,
  };
}

/**
 * Works one idea (docs/16 §5.2): one conversation on the resident's model,
 * which picks a granted tool or finishes; each tool runs its fixed recipe
 * and the result goes back. Every turn is saved as a step with the
 * resolution before the next, so a redelivery resumes. Stops at
 * `finish_idea`, or forces it at 5 tool calls or 8 turns.
 */
export async function runIdeaActions(message: IdeaActionMessage, deps: IdeaActionDeps = {}): Promise<IdeaActionOutcome> {
  const now = deps.now ?? (() => new Date());
  const context = { personaId: message.persona_id, ideaId: message.idea_id };
  const residentDao = deps.residentDao ?? new ResidentDao(createDocumentClient(), requireEnv("RESIDENTS_TABLE_NAME"));
  const ideaDao = deps.ideaDao ?? new ResidentIdeaDao(createDocumentClient(), requireEnv("RESIDENT_IDEAS_TABLE_NAME"), requireEnv("RESIDENTS_TABLE_NAME"));
  const takeTurn = deps.takeTurn ?? ((request: ModelTurnRequest) => takeModelTurn(request, new BedrockRuntimeClient({})));
  const call = deps.call ?? ((request: PublicApiRequest) => callPublicApi(request));

  const resident = await residentDao.getCurrent(message.persona_id);
  if (!resident) {
    logWarn("IdeaActionsUnknownResident", context);
    return { outcome: "SKIPPED_UNKNOWN_RESIDENT" };
  }
  const found = await ideaDao.getIdeaWithSteps(message.persona_id, message.idea_id);
  if (!found) {
    logWarn("IdeaActionsUnknownIdea", context);
    return { outcome: "SKIPPED_UNKNOWN_IDEA" };
  }
  if (FINISHED_RESOLUTION_STATUSES.includes(found.idea.resolution.status)) {
    logInfo("IdeaActionsAlreadyFinished", { ...context, status: found.idea.resolution.status });
    return { outcome: "SKIPPED_ALREADY_FINISHED" };
  }
  const tools = grantedTools(resident);
  if (tools.length === 0) {
    logInfo("IdeaActionsNoTools", context);
    return { outcome: "SKIPPED_NO_TOOLS" };
  }

  const idea = found.idea;
  const steps = [...found.steps];
  let resolution = idea.resolution;
  let featureRequests = await ideaDao.listFeatureRequestThreads(resident.persona_id);
  const messages = rebuildMessages(describeIdea(idea, featureRequests, now()), steps);
  let unusableTurns = 0;
  logInfo("IdeaActionsStarted", { ...context, resumedAtStep: steps.length, tools: tools.map((tool) => tool.name) });

  const save = async (step: IdeaStep, next: IdeaResolution, threadWrites: Parameters<ResidentIdeaDao["appendStep"]>[2] = []): Promise<boolean> => {
    try {
      await ideaDao.appendStep(step, next, threadWrites);
    } catch (err) {
      if (!(err instanceof TerminalError)) throw err;
      logWarn("IdeaActionsConflict", { ...context, sequence: step.sequence, error: err.message });
      return false;
    }
    steps.push(step);
    resolution = next;
    logInfo("IdeaActionsStepSaved", { ...context, sequence: step.sequence, kind: step.kind, tool: step.decision?.tool ?? null, status: next.status });
    return true;
  };
  const baseStep = (sequence: number, turn: ModelTurn | null): Pick<IdeaStep, "persona_id" | "sk" | "idea_id" | "sequence" | "input_tokens" | "output_tokens" | "created_at"> => ({
    persona_id: resident.persona_id,
    sk: stepSortKey(idea.idea_id, sequence),
    idea_id: idea.idea_id,
    sequence,
    input_tokens: turn?.inputTokens ?? 0,
    output_tokens: turn?.outputTokens ?? 0,
    created_at: now().toISOString(),
  });

  for (;;) {
    const sequence = steps.length + 1;
    const toolCalls = steps.filter((step) => step.kind === "TOOL_CALL");
    /* The last allowed turn, or a full tool budget, offers only finish_idea and forces it. */
    const forced = steps.length + unusableTurns >= MAX_TURNS - 1 || toolCalls.length >= MAX_TOOL_CALLS;
    const toolContext: ToolContext = { resident, idea, featureRequests, sequence, now, call };
    const offered = forced
      ? []
      : tools.filter((tool) => tool.runnable(toolContext) && toolCalls.filter((step) => step.decision?.tool === tool.name).length < tool.maxPerIdea);

    if (steps.length + unusableTurns >= MAX_TURNS) {
      const step: IdeaStep = { ...baseStep(sequence, null), kind: "FORCED_FINISH", decision: null, execution: null };
      const next = nextResolution(resolution, step, resident, now().toISOString(), { status: "MAX_DEPTH_REACHED", summary: null, follow_up: null });
      if (!(await save(step, next))) return { outcome: "STOPPED_CONFLICT" };
      logInfo("IdeaActionsForcedFinish", { ...context, steps: steps.length, unusableTurns });
      return { outcome: "FINISHED", status: "MAX_DEPTH_REACHED", steps: steps.length };
    }

    const turn = await takeTurn({
      modelId: resident.model_id,
      system: resident.action_prompt,
      messages,
      tools: [...offered.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema(toolContext) })), FINISH_TOOL_SPEC],
      ...(forced ? { forceTool: FINISH_TOOL } : {}),
    });

    if (turn.toolUse?.name === FINISH_TOOL) {
      const finish = FinishInputSchema.safeParse(turn.toolUse.input);
      if (finish.success) {
        const step: IdeaStep = { ...baseStep(sequence, turn), kind: "FINISH", decision: { tool: FINISH_TOOL, input: turn.toolUse.input, model_text: turn.text }, execution: null };
        const next = nextResolution(resolution, step, resident, now().toISOString(), { status: finish.data.resolution, summary: finish.data.summary, follow_up: finish.data.follow_up ?? null });
        if (!(await save(step, next))) return { outcome: "STOPPED_CONFLICT" };
        logInfo("IdeaActionsFinished", { ...context, status: next.status, steps: steps.length });
        return { outcome: "FINISHED", status: next.status, steps: steps.length };
      }
    }

    const tool = offered.find((candidate) => candidate.name === turn.toolUse?.name);
    if (!turn.toolUse || !tool) {
      unusableTurns++;
      logWarn("IdeaActionsUnusableTurn", { ...context, tool: turn.toolUse?.name ?? null, input: turn.toolUse?.input ?? null, text: turn.text, unusableTurns });
      continue;
    }

    const outcome = await tool.run(toolContext, turn.toolUse.input);
    const step: IdeaStep = {
      ...baseStep(sequence, turn),
      kind: "TOOL_CALL",
      decision: { tool: tool.name, input: turn.toolUse.input, model_text: turn.text },
      execution: outcome.execution,
    };
    if (!(await save(step, nextResolution(resolution, step, resident, now().toISOString()), outcome.threadWrites))) return { outcome: "STOPPED_CONFLICT" };
    if (outcome.threadWrites.some((write) => write.kind !== "ORDER_CHECKED")) {
      featureRequests = await ideaDao.listFeatureRequestThreads(resident.persona_id);
    }
    messages.push(...stepMessages(step));
  }
}
