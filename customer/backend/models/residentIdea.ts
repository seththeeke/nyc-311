import { z } from "zod";
import { ACTION_TYPES, IDEA_TYPES } from "./resident";

/*
 * Rows in `ResidentIdeas` (docs/13-customer-simulation.md §2 customer side,
 * decisions 4, 6 and 7). Ideas sort under `IDEA#<ulid>`; one thread row per
 * resident per order under `ORDER#<order_id>`. An idea stores only the ids
 * of its order; the read API fills in the rest from the order row.
 */

export const IDEA_STATUSES = ["OPEN"] as const;
export const ACTION_STATUSES = ["COMPLETED", "FAILED"] as const;

/* Every idea carries this, so the Feed index lists all residents' ideas newest first. */
export const IDEA_FEED_PK = "ALL";

/* One tool invocation (decision 7). Evidence fields vary by tool, so the rest passes through. */
export const ResidentIdeaActionSchema = z
  .object({
    sequence: z.number().int().min(1),
    type: z.enum(ACTION_TYPES),
    status: z.enum(ACTION_STATUSES),
    started_at: z.string().min(1),
    completed_at: z.string().min(1),
    summary: z.string().min(1),
    outcome: z.string().min(1).nullable(),
  })
  .passthrough();
export type ResidentIdeaAction = z.infer<typeof ResidentIdeaActionSchema>;

export const ResidentIdeaSchema = z.object({
  persona_id: z.string().min(1),
  sk: z.string().regex(/^IDEA#.+$/),
  idea_id: z.string().min(1),
  persona_version: z.number().int().min(1),
  idea_type: z.enum(IDEA_TYPES),
  text: z.string().min(1),
  order_id: z.string().min(1).nullable(),
  external_unique_key: z.string().min(1).nullable(),
  /* `persona_id#order_id`, only on ideas about an order (the sparse ByOrder index). */
  by_order_pk: z.string().min(1).optional(),
  feed_pk: z.literal(IDEA_FEED_PK),
  /* `persona_id`, only on idea rows (the sparse ByResident index, docs/16 §5.3). Optional until older ideas are backfilled. */
  resident_pk: z.string().min(1).optional(),
  status: z.enum(IDEA_STATUSES),
  actions: z.array(ResidentIdeaActionSchema),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  created_at: z.string().min(1),
});
export type ResidentIdea = z.infer<typeof ResidentIdeaSchema>;

export const ResidentOrderThreadSchema = z.object({
  persona_id: z.string().min(1),
  sk: z.string().regex(/^ORDER#.+$/),
  order_id: z.string().min(1),
  idea_count: z.number().int().min(1),
  first_idea_at: z.string().min(1),
  last_idea_at: z.string().min(1),
});
export type ResidentOrderThread = z.infer<typeof ResidentOrderThreadSchema>;

export const IDEA_SK_PREFIX = "IDEA#";
export const THREAD_SK_PREFIX = "ORDER#";

export function ideaSortKey(ideaId: string): string {
  return `${IDEA_SK_PREFIX}${ideaId}`;
}

export function threadSortKey(orderId: string): string {
  return `${THREAD_SK_PREFIX}${orderId}`;
}

export function byOrderKey(personaId: string, orderId: string): string {
  return `${personaId}#${orderId}`;
}
