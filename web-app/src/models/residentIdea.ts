import { z } from "zod";

/*
 * One Idea — a persona's "I need something" (13-customer-simulation.md
 * §2/§3), as the planned resident read API would return it. The anchor
 * is the order it is about, filled in by the read API from the customer's
 * order row (which never expires); feature requests have none.
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

export const IdeaAnchorSchema = z.object({
  order_id: z.string().min(1),
  external_unique_key: z.string().min(1),
  descriptor: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
});
export type IdeaAnchor = z.infer<typeof IdeaAnchorSchema>;

/*
 * How an idea was worked (docs/16-resident-action-models.md §5.3): the
 * summary kept on the idea, and the step log returned with one idea. Ideas
 * from before the action loop, and an API that predates it, read as not
 * actioned with no steps.
 */
export const RESOLUTION_STATUSES = ["NOT_ACTIONED", "IN_PROGRESS", "SATISFIED", "UNSATISFIED", "GAVE_UP", "MAX_DEPTH_REACHED"] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];

export const IdeaResolutionSchema = z.object({
  status: z.enum(RESOLUTION_STATUSES),
  /* The resident's own closing words; null until finished. */
  summary: z.string().nullable(),
  follow_up: z.string().nullable(),
  tools_used: z.array(z.string()),
  step_count: z.number().int().min(0),
  last_step_sequence: z.number().int().min(0),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  prompt_version: z.string().nullable(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
});
export type IdeaResolution = z.infer<typeof IdeaResolutionSchema>;

export function notActionedResolution(): IdeaResolution {
  return {
    status: "NOT_ACTIONED",
    summary: null,
    follow_up: null,
    tools_used: [],
    step_count: 0,
    last_step_sequence: 0,
    started_at: null,
    finished_at: null,
    prompt_version: null,
    input_tokens: 0,
    output_tokens: 0,
  };
}

export const STEP_KINDS = ["TOOL_CALL", "FINISH", "FORCED_FINISH"] as const;

/* One model turn: what the resident chose, and what the tool did. */
export const IdeaStepSchema = z.object({
  sequence: z.number().int().min(1),
  kind: z.enum(STEP_KINDS),
  decision: z.object({ tool: z.string().min(1), input: z.record(z.string(), z.unknown()), model_text: z.string().nullable() }).nullable(),
  execution: z
    .object({
      status: z.enum(["COMPLETED", "FAILED"]),
      summary: z.string().min(1),
      request: z.object({ method: z.string().min(1), path: z.string().min(1), body: z.unknown().optional() }).nullable(),
      response: z.object({ status_code: z.number().int(), call_id: z.string().nullable(), body: z.unknown() }).nullable(),
      error: z.string().nullable(),
      started_at: z.string().min(1),
      completed_at: z.string().min(1),
    })
    .nullable(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  created_at: z.string().min(1),
});
export type IdeaStep = z.infer<typeof IdeaStepSchema>;

export const ResidentIdeaSchema = z.object({
  idea_id: z.string().min(1),
  persona_id: z.string().min(1),
  persona_version: z.number().int().min(1),
  idea_type: z.enum(IDEA_TYPES),
  text: z.string().min(1),
  anchor: IdeaAnchorSchema.nullable(),
  /* The feature request this idea follows up on, if any. */
  feature_request_id: z.string().min(1).nullable().default(null),
  resolution: IdeaResolutionSchema.default(notActionedResolution),
  created_at: z.string().min(1),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
});
export type ResidentIdea = z.infer<typeof ResidentIdeaSchema>;

/* `GET /residents/{id}/ideas/{ideaId}`: the idea with its workstream, oldest step first. */
export const ResidentIdeaDetailSchema = ResidentIdeaSchema.extend({
  steps: z.array(IdeaStepSchema).default([]),
});
export type ResidentIdeaDetail = z.infer<typeof ResidentIdeaDetailSchema>;

/* `GET /ideas` and `GET /residents/{id}/ideas` — newest first, paginated with an opaque cursor. */
export const ResidentIdeaPageSchema = z.object({
  items: z.array(ResidentIdeaSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type ResidentIdeaPage = z.infer<typeof ResidentIdeaPageSchema>;
