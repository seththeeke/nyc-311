import type { ResidentIdeaDao } from "../../dao/residentIdea/residentIdeaDao";
import type { WebhookCustomerFacingOrderDao } from "../../dao/webhookCustomerFacingOrder/webhookCustomerFacingOrderDao";
import { logInfo } from "../../logger";
import type { ResidentCurrent } from "../../models/resident";
import type { ResidentIdea } from "../../models/residentIdea";
import type { WebhookCustomerFacingOrder } from "../../models/webhookCustomerFacingOrder";
import { newPickKey } from "./ulid";

/* How much the model is shown: a handful of fresh orders and recent history keeps the prompt small. */
export const MAX_CANDIDATES = 5;
export const RECENT_IDEAS = 8;
const SAMPLE_PER_BOROUGH = 20;

export interface IdeaContext {
  /** Open orders in the resident's boroughs they have never had an idea about. */
  candidates: WebhookCustomerFacingOrder[];
  /** Their latest ideas, newest first. */
  recentIdeas: ResidentIdea[];
  /** The current state of the orders those ideas were about. */
  followedOrders: WebhookCustomerFacingOrder[];
}

export interface IdeaContextDeps {
  ideaDao: ResidentIdeaDao;
  orderDao: WebhookCustomerFacingOrderDao;
  random?: () => number;
  pickKey?: () => string;
}

/**
 * Gathers what the model sees (§3 Flow B decision 1): code chooses what
 * is eligible, the model chooses what to do with it. Fresh candidates are
 * sampled from a random point per borough (§2 customer side, decision 5),
 * with the resident's preferred descriptors first.
 */
export async function gatherIdeaContext(resident: ResidentCurrent, deps: IdeaContextDeps): Promise<IdeaContext> {
  const random = deps.random ?? Math.random;
  const pickKey = deps.pickKey ?? (() => newPickKey());
  const [threads, recent] = await Promise.all([
    deps.ideaDao.listThreads(resident.persona_id),
    deps.ideaDao.listForResident(resident.persona_id, RECENT_IDEAS, undefined),
  ]);
  const seen = new Set(threads.map((thread) => thread.order_id));

  const boroughs = [...resident.interests.boroughs].sort(() => random() - 0.5);
  const sampled: WebhookCustomerFacingOrder[] = [];
  for (const borough of boroughs) {
    const rows = await deps.orderDao.sampleOpenOrders(borough, pickKey(), SAMPLE_PER_BOROUGH);
    sampled.push(...rows.filter((order) => !seen.has(order.order_id)));
    if (sampled.length >= MAX_CANDIDATES * 2) break;
  }
  const preferred = new Set(resident.interests.descriptors);
  const candidates = [...sampled]
    .sort((a, b) => Number(preferred.has(b.descriptor ?? "")) - Number(preferred.has(a.descriptor ?? "")))
    .slice(0, MAX_CANDIDATES);

  const followedIds = recent.items.flatMap((idea) => (idea.order_id ? [idea.order_id] : []));
  const followedOrders = await deps.orderDao.batchGetOrders(followedIds);

  logInfo("IdeaContextGathered", {
    personaId: resident.persona_id,
    threadCount: threads.length,
    sampledCount: sampled.length,
    candidateIds: candidates.map((order) => order.order_id),
    recentIdeaCount: recent.items.length,
    followedOrderIds: followedOrders.map((order) => order.order_id),
  });
  return { candidates, recentIdeas: recent.items, followedOrders };
}

function describeOrder(order: WebhookCustomerFacingOrder, now: Date): string {
  const days = Math.max(0, Math.round((now.getTime() - Date.parse(order.accepted_at)) / 86_400_000));
  const where = [order.address, order.borough].filter(Boolean).join(", ") || "address unknown";
  const state = order.status === "CLOSED" ? `marked repaired ${order.resolved_at ?? ""}`.trim() : "still open";
  return `- order ${order.order_id}: ${order.descriptor ?? "street problem"} at ${where}; accepted ${days} day(s) ago; ${state}`;
}

/** The user turn: what is around the resident right now, in plain lines. */
export function describeContext(context: IdeaContext, now: Date): string {
  const sections = [`It is ${now.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })} in New York.`];
  sections.push(
    context.candidates.length > 0
      ? `Open repair orders near you that you have not raised before:\n${context.candidates.map((order) => describeOrder(order, now)).join("\n")}`
      : "There are no new open repair orders near you right now."
  );
  if (context.followedOrders.length > 0) {
    sections.push(`Orders you have raised before, as they stand now:\n${context.followedOrders.map((order) => describeOrder(order, now)).join("\n")}`);
  }
  sections.push(
    context.recentIdeas.length > 0
      ? `Your recent ideas, newest first:\n${context.recentIdeas
          .map((idea) => `- ${idea.created_at.slice(0, 10)} ${idea.idea_type}${idea.order_id ? ` about order ${idea.order_id}` : ""}: ${idea.text}`)
          .join("\n")}`
      : "You have not raised anything before."
  );
  return sections.join("\n\n");
}
