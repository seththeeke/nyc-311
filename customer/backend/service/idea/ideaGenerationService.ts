import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { ResidentDao } from "../../dao/resident/residentDao";
import { ResidentIdeaDao } from "../../dao/residentIdea/residentIdeaDao";
import { WebhookCustomerFacingOrderDao } from "../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import type { IdeaWorkerEvent } from "../../models/ideaWorkerEvent";
import { IDEA_FEED_PK, byOrderKey, ideaSortKey, type ResidentIdea } from "../../models/residentIdea";
import { generateIdea, type GeneratorRequest, type GeneratorResult } from "./bedrockIdeaGenerator";
import { describeContext, gatherIdeaContext } from "./ideaContext";
import { newUlid } from "./ulid";

export type IdeaWorkerOutcome =
  | { outcome: "CREATED"; ideaId: string }
  | { outcome: "SKIPPED_UNKNOWN_RESIDENT" | "SKIPPED_ROLL" | "SKIPPED_NOTHING_TO_SAY" | "SKIPPED_UNUSABLE" };

export interface IdeaWorkerDeps {
  residentDao?: ResidentDao;
  ideaDao?: ResidentIdeaDao;
  orderDao?: WebhookCustomerFacingOrderDao;
  generate?: (request: GeneratorRequest) => Promise<GeneratorResult>;
  random?: () => number;
  now?: () => Date;
}

/**
 * One scheduled thought (§3 Flow B): roll the resident's activity level,
 * gather what is around them, let their model decide the idea or that
 * there is nothing to say, and record it with its thread row and the
 * resident's counters. No actions yet: no tool bucket is granted, so the
 * idea is written with `actions: []` and nothing is queued.
 */
export async function runIdeaWorker(event: IdeaWorkerEvent, deps: IdeaWorkerDeps = {}): Promise<IdeaWorkerOutcome> {
  const random = deps.random ?? Math.random;
  const now = (deps.now ?? (() => new Date()))();
  const residentDao = deps.residentDao ?? new ResidentDao(createDocumentClient(), requireEnv("RESIDENTS_TABLE_NAME"));
  const context = { personaId: event.persona_id };

  const resident = await residentDao.getCurrent(event.persona_id);
  if (!resident) {
    logWarn("IdeaWorkerUnknownResident", context);
    return { outcome: "SKIPPED_UNKNOWN_RESIDENT" };
  }
  const roll = random() * 100;
  if (!event.force && roll >= resident.activity_level) {
    logInfo("IdeaWorkerSkippedRoll", { ...context, roll, activityLevel: resident.activity_level });
    return { outcome: "SKIPPED_ROLL" };
  }
  logInfo("IdeaWorkerThinking", { ...context, roll, activityLevel: resident.activity_level, force: event.force ?? false, version: resident.version });

  const ideaDao = deps.ideaDao ?? new ResidentIdeaDao(createDocumentClient(), requireEnv("RESIDENT_IDEAS_TABLE_NAME"), requireEnv("RESIDENTS_TABLE_NAME"));
  const orderDao = deps.orderDao ?? new WebhookCustomerFacingOrderDao(createDocumentClient(), requireEnv("CUSTOMER_ORDERS_TABLE_NAME"));
  const ideaContext = await gatherIdeaContext(resident, { ideaDao, orderDao, random });
  const offered = [...ideaContext.candidates, ...ideaContext.followedOrders];
  const generate = deps.generate ?? ((request: GeneratorRequest) => generateIdea(request, new BedrockRuntimeClient({})));
  const result = await generate({
    modelId: resident.model_id,
    systemPrompt: resident.idea_prompt,
    userMessage: describeContext(ideaContext, now),
    orderIds: offered.map((order) => order.order_id),
  });

  if (result.kind === "NOTHING_TO_SAY") {
    logInfo("IdeaWorkerNothingToSay", { ...context, reason: result.reason, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
    return { outcome: "SKIPPED_NOTHING_TO_SAY" };
  }
  if (result.kind === "UNUSABLE") {
    logWarn("IdeaWorkerUnusableOutput", { ...context, reason: result.reason, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
    return { outcome: "SKIPPED_UNUSABLE" };
  }

  const ideaId = newUlid(now);
  const order = offered.find((candidate) => candidate.order_id === result.orderId) ?? null;
  const idea: ResidentIdea = {
    persona_id: resident.persona_id,
    sk: ideaSortKey(ideaId),
    idea_id: ideaId,
    persona_version: resident.version,
    idea_type: result.ideaType,
    text: result.text,
    order_id: order?.order_id ?? null,
    external_unique_key: order?.external_unique_key ?? null,
    ...(order ? { by_order_pk: byOrderKey(resident.persona_id, order.order_id) } : {}),
    feed_pk: IDEA_FEED_PK,
    status: "OPEN",
    actions: [],
    model_id: resident.model_id,
    prompt_version: resident.prompt_version,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    created_at: now.toISOString(),
  };
  await ideaDao.recordIdea(idea);
  logInfo("IdeaWorkerIdeaCreated", { ...context, ideaId, ideaType: idea.idea_type, orderId: idea.order_id });
  return { outcome: "CREATED", ideaId };
}
