import { z } from "zod";

/*
 * One Idea — a persona's "I need something" (13-customer-simulation.md
 * §2/§3), as the planned customer read API would return it. The anchor
 * is a snapshot of the order it is about, so it still renders after the
 * order leaves play; feature requests have none.
 */

export const IDEA_TYPES = [
  "STATUS_CHECK",
  "SERVICED_CHECK",
  "ETA_REQUEST",
  "PRIORITY_INQUIRY",
  "ESCALATION",
  "FEATURE_REQUEST",
] as const;
export type IdeaType = (typeof IDEA_TYPES)[number];

export const IDEA_STATUSES = ["OPEN"] as const;

export const IdeaAnchorSchema = z.object({
  order_id: z.string().min(1),
  external_unique_key: z.string().min(1),
  descriptor: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
});
export type IdeaAnchor = z.infer<typeof IdeaAnchorSchema>;

export const CustomerIdeaSchema = z.object({
  idea_id: z.string().min(1),
  persona_id: z.string().min(1),
  persona_version: z.number().int().min(1),
  idea_type: z.enum(IDEA_TYPES),
  text: z.string().min(1),
  anchor: IdeaAnchorSchema.nullable(),
  status: z.enum(IDEA_STATUSES),
  created_at: z.string().min(1),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
});
export type CustomerIdea = z.infer<typeof CustomerIdeaSchema>;

/* `GET /ideas` and `GET /customers/{id}/ideas` — newest first, paginated with an opaque cursor. */
export const CustomerIdeaPageSchema = z.object({
  items: z.array(CustomerIdeaSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type CustomerIdeaPage = z.infer<typeof CustomerIdeaPageSchema>;
