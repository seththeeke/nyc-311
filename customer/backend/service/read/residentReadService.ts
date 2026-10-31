import { decodeCursor } from "../../dao/cursor";
import { ResidentDao } from "../../dao/resident/residentDao";
import { ResidentIdeaDao } from "../../dao/residentIdea/residentIdeaDao";
import { WebhookCustomerFacingOrderDao } from "../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo } from "../../logger";
import { NotFoundError, ValidationError } from "../../models/errors";
import type { ResidentCurrent } from "../../models/resident";
import type { IdeaStep, ResidentIdea } from "../../models/residentIdea";
import type { IdeaStepView, Page, ResidentIdeaDetailView, ResidentIdeaView, ResidentView } from "../../models/residentView";
import type { WebhookCustomerFacingOrder } from "../../models/webhookCustomerFacingOrder";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface ResidentReadDeps {
  residentDao?: ResidentDao;
  ideaDao?: ResidentIdeaDao;
  orderDao?: WebhookCustomerFacingOrderDao;
}

/* Constructed lazily (CLAUDE.md §5.2) — never module-scope singletons. */
function residentDaoOf(deps: ResidentReadDeps): ResidentDao {
  return deps.residentDao ?? new ResidentDao(createDocumentClient(), requireEnv("RESIDENTS_TABLE_NAME"));
}
function ideaDaoOf(deps: ResidentReadDeps): ResidentIdeaDao {
  return deps.ideaDao ?? new ResidentIdeaDao(createDocumentClient(), requireEnv("RESIDENT_IDEAS_TABLE_NAME"), requireEnv("RESIDENTS_TABLE_NAME"));
}
function orderDaoOf(deps: ResidentReadDeps): WebhookCustomerFacingOrderDao {
  return deps.orderDao ?? new WebhookCustomerFacingOrderDao(createDocumentClient(), requireEnv("CUSTOMER_ORDERS_TABLE_NAME"));
}

/** `limit` from the query string: default 20, at most 50 (§2 customer side, decision 9). */
export function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PAGE_SIZE;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) throw new ValidationError(`limit must be a whole number from 1 to ${MAX_PAGE_SIZE}`);
  return limit;
}

export function toResidentView(resident: ResidentCurrent): ResidentView {
  return {
    persona_id: resident.persona_id,
    version: resident.version,
    name: resident.name,
    tagline: resident.tagline,
    backstory: resident.backstory,
    persona_prompt: resident.persona_prompt,
    model_key: resident.model_key,
    model_id: resident.model_id,
    demeanor: resident.demeanor,
    activity_level: resident.activity_level,
    active_hours: resident.active_hours,
    follow_up_propensity: resident.follow_up_propensity,
    interests: resident.interests,
    idea_count: resident.idea_count,
    last_idea_at: resident.last_idea_at,
  };
}

/* The anchor comes from the order row (decision 6); a missing row still yields the ids the idea stored. */
export function toIdeaView(idea: ResidentIdea, orders: Map<string, WebhookCustomerFacingOrder>): ResidentIdeaView {
  const order = idea.order_id ? orders.get(idea.order_id) : undefined;
  const anchor =
    idea.order_id && idea.external_unique_key
      ? {
          order_id: idea.order_id,
          external_unique_key: idea.external_unique_key,
          descriptor: order?.descriptor ?? null,
          borough: order?.borough ?? null,
          address: order?.address ?? null,
        }
      : null;
  return {
    idea_id: idea.idea_id,
    persona_id: idea.persona_id,
    persona_version: idea.persona_version,
    idea_type: idea.idea_type,
    text: idea.text,
    anchor,
    resolution: idea.resolution,
    created_at: idea.created_at,
    model_id: idea.model_id,
    prompt_version: idea.prompt_version,
    input_tokens: idea.input_tokens,
    output_tokens: idea.output_tokens,
  };
}

export function toStepView(step: IdeaStep): IdeaStepView {
  return {
    sequence: step.sequence,
    kind: step.kind,
    decision: step.decision,
    execution: step.execution,
    input_tokens: step.input_tokens,
    output_tokens: step.output_tokens,
    created_at: step.created_at,
  };
}

async function withAnchors(ideas: ResidentIdea[], deps: ResidentReadDeps): Promise<ResidentIdeaView[]> {
  const orderIds = ideas.flatMap((idea) => (idea.order_id ? [idea.order_id] : []));
  const orders = orderIds.length > 0 ? await orderDaoOf(deps).batchGetOrders(orderIds) : [];
  const byId = new Map(orders.map((order) => [order.order_id, order]));
  return ideas.map((idea) => toIdeaView(idea, byId));
}

export async function listResidents(limit: number, cursor: string | undefined, deps: ResidentReadDeps = {}): Promise<Page<ResidentView>> {
  const page = await residentDaoOf(deps).listCurrent(limit, decodeCursor(cursor));
  logInfo("ResidentsListed", { count: page.items.length, hasMore: page.lastKey !== null });
  return { items: page.items.map(toResidentView), nextCursor: page.lastKey };
}

/** @throws {@link NotFoundError} for an unknown resident. */
export async function getResident(personaId: string, deps: ResidentReadDeps = {}): Promise<ResidentView> {
  const resident = await residentDaoOf(deps).getCurrent(personaId);
  if (!resident) throw new NotFoundError(`No resident ${personaId}`);
  return toResidentView(resident);
}

/**
 * Ideas newest first: every resident's (the Feed index) or one
 * resident's. A cursor issued for another resident is rejected.
 *
 * @throws {@link ValidationError} for a bad or foreign cursor.
 */
export async function listIdeas(
  query: { personaId?: string; limit: number; cursor?: string },
  deps: ResidentReadDeps = {}
): Promise<Page<ResidentIdeaView>> {
  const startKey = decodeCursor(query.cursor);
  const ideaDao = ideaDaoOf(deps);
  if (query.personaId && startKey && startKey.persona_id !== query.personaId) throw new ValidationError("Cursor belongs to another resident");
  const page = query.personaId ? await ideaDao.listForResident(query.personaId, query.limit, startKey) : await ideaDao.listFeed(query.limit, startKey);
  logInfo("IdeasListed", { personaId: query.personaId ?? null, count: page.items.length, hasMore: page.lastKey !== null });
  return { items: await withAnchors(page.items, deps), nextCursor: page.lastKey };
}

/**
 * One idea with its whole workstream (docs/16 §5.3, R1), from one query.
 *
 * @throws {@link NotFoundError} for an unknown idea.
 */
export async function getIdea(personaId: string, ideaId: string, deps: ResidentReadDeps = {}): Promise<ResidentIdeaDetailView> {
  const found = await ideaDaoOf(deps).getIdeaWithSteps(personaId, ideaId);
  if (!found) throw new NotFoundError(`No idea ${ideaId} for resident ${personaId}`);
  const [view] = await withAnchors([found.idea], deps);
  logInfo("IdeaRead", { personaId, ideaId, stepCount: found.steps.length, resolution: found.idea.resolution.status });
  return { ...view, steps: found.steps.map(toStepView) };
}
