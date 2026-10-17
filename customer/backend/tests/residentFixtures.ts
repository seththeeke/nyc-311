import hawthorn from "../residents/hawthorn.json";
import { RESIDENT_CURRENT_SK, RESIDENT_ROSTER_PK, ResidentSeedSchema, type ResidentCurrent, type ResidentSeed } from "../models/resident";
import { IDEA_FEED_PK, type ResidentIdea } from "../models/residentIdea";
import type { WebhookCustomerFacingOrder } from "../models/webhookCustomerFacingOrder";
import { buildResidentContent } from "../service/resident/residentSyncService";
import { openOrder } from "./fixtures";

/* Resident-side fixtures shared across the customer package's tests. */

export const seed: ResidentSeed = ResidentSeedSchema.parse(hawthorn);

export const current: ResidentCurrent = {
  ...buildResidentContent(seed),
  sk: RESIDENT_CURRENT_SK,
  version: 3,
  roster_pk: RESIDENT_ROSTER_PK,
  idea_count: 2,
  last_idea_at: "2026-10-16T13:00:00.000Z",
  created_at: "2026-10-14T15:00:00.000Z",
  updated_at: "2026-10-16T13:00:00.000Z",
};

export const idea: ResidentIdea = {
  persona_id: "hawthorn",
  sk: "IDEA#01K7Z3M8Q4D2V6T9R1XB5C0EHN",
  idea_id: "01K7Z3M8Q4D2V6T9R1XB5C0EHN",
  persona_version: 3,
  idea_type: "ETA_REQUEST",
  text: "I want a date for the trench outside my shop.",
  order_id: "01ORDER",
  external_unique_key: "69860415",
  by_order_pk: "hawthorn#01ORDER",
  feed_pk: IDEA_FEED_PK,
  status: "OPEN",
  actions: [],
  model_id: "amazon.nova-micro-v1:0",
  prompt_version: "idea-generator@1",
  input_tokens: 812,
  output_tokens: 46,
  created_at: "2026-10-17T13:12:08.000Z",
};

export const featureIdea: ResidentIdea = {
  ...idea,
  sk: "IDEA#01K7Z3M8Q4D2V6T9R1XB5C0EHP",
  idea_id: "01K7Z3M8Q4D2V6T9R1XB5C0EHP",
  idea_type: "FEATURE_REQUEST",
  text: "Let me get a text when a repair near me is booked.",
  order_id: null,
  external_unique_key: null,
  by_order_pk: undefined,
};
delete featureIdea.by_order_pk;

export function order(id: string, overrides: Partial<WebhookCustomerFacingOrder> = {}): WebhookCustomerFacingOrder {
  return { ...openOrder, order_id: id, ...overrides };
}
