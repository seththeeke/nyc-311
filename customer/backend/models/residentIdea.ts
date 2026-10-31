import { z } from "zod";
import { IDEA_TYPES } from "./resident";

/*
 * Rows in `ResidentIdeas` (docs/13-customer-simulation.md §2 customer side;
 * docs/16-resident-action-models.md §5.3). Ideas sort under `IDEA#<ulid>`,
 * each idea's workstream steps under `IDEA#<ulid>#STEP#<nnnn>`, one thread
 * row per resident per order under `ORDER#<order_id>`. An idea stores only
 * the ids of its order; the read API fills in the rest from the order row.
 */

/* Every idea carries this, so the Feed index lists all residents' ideas newest first. */
export const IDEA_FEED_PK = "ALL";

/* An idea's lifecycle (docs/16 §5.3): not actioned, being worked, or finished one of four ways. */
export const RESOLUTION_STATUSES = ["NOT_ACTIONED", "IN_PROGRESS", "SATISFIED", "UNSATISFIED", "GAVE_UP", "MAX_DEPTH_REACHED"] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];
export const FINISHED_RESOLUTION_STATUSES: readonly ResolutionStatus[] = ["SATISFIED", "UNSATISFIED", "GAVE_UP", "MAX_DEPTH_REACHED"];

/* The summary of an idea's workstream, kept on the idea row and updated with each step. */
export const IdeaResolutionSchema = z.object({
  status: z.enum(RESOLUTION_STATUSES),
  /* The resident's own closing words; null until finished. */
  summary: z.string().min(1).nullable(),
  follow_up: z.string().min(1).nullable(),
  tools_used: z.array(z.string().min(1)),
  step_count: z.number().int().min(0),
  last_step_sequence: z.number().int().min(0),
  started_at: z.string().min(1).nullable(),
  finished_at: z.string().min(1).nullable(),
  prompt_version: z.string().min(1).nullable(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
});
export type IdeaResolution = z.infer<typeof IdeaResolutionSchema>;

/** The resolution of an idea nobody has worked yet. */
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
export type StepKind = (typeof STEP_KINDS)[number];
export const STEP_EXECUTION_STATUSES = ["COMPLETED", "FAILED"] as const;

/* What the model chose on one turn: the tool it called (or finish_idea), its input, and anything it said. */
export const StepDecisionSchema = z.object({
  tool: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  model_text: z.string().nullable(),
});

/* What the tool's recipe did. A recipe check that fails before any call has no request or response. */
export const StepExecutionSchema = z.object({
  status: z.enum(STEP_EXECUTION_STATUSES),
  summary: z.string().min(1),
  request: z.object({ method: z.string().min(1), path: z.string().min(1), body: z.unknown().optional() }).nullable(),
  response: z.object({ status_code: z.number().int(), call_id: z.string().min(1).nullable(), body: z.unknown() }).nullable(),
  error: z.string().min(1).nullable(),
  started_at: z.string().min(1),
  completed_at: z.string().min(1),
});
export type StepExecution = z.infer<typeof StepExecutionSchema>;

/* One model turn in an idea's workstream, written once (docs/16 §5.3). */
export const IdeaStepSchema = z.object({
  persona_id: z.string().min(1),
  sk: z.string().regex(/^IDEA#.+#STEP#\d{4}$/),
  idea_id: z.string().min(1),
  sequence: z.number().int().min(1),
  kind: z.enum(STEP_KINDS),
  /* Null only on FORCED_FINISH, where the loop, not the model, closed the idea. */
  decision: StepDecisionSchema.nullable(),
  /* Null on FINISH and FORCED_FINISH. */
  execution: StepExecutionSchema.nullable(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  created_at: z.string().min(1),
});
export type IdeaStep = z.infer<typeof IdeaStepSchema>;

export const ResidentIdeaSchema = z.object({
  persona_id: z.string().min(1),
  sk: z.string().regex(/^IDEA#.+$/),
  idea_id: z.string().min(1),
  persona_version: z.number().int().min(1),
  idea_type: z.enum(IDEA_TYPES),
  text: z.string().min(1),
  order_id: z.string().min(1).nullable(),
  external_unique_key: z.string().min(1).nullable(),
  /* A feature request this idea follows up on (docs/16 §5.4); null for every idea before idea-generator@2. */
  feature_request_id: z.string().min(1).nullable().default(null),
  /* `persona_id#order_id`, only on ideas about an order (the sparse ByOrder index). */
  by_order_pk: z.string().min(1).optional(),
  feed_pk: z.literal(IDEA_FEED_PK),
  /* `persona_id`, only on idea rows (the sparse ByResident index, docs/16 §5.3). Ideas from before C1 got it by backfill. */
  resident_pk: z.string().min(1).optional(),
  /* Ideas from before the action loop have none stored; they read as not actioned. */
  resolution: IdeaResolutionSchema.default(notActionedResolution),
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
  /* What the resident last saw when they searched for this order (docs/16 §5.4); absent until they do. */
  last_known_status: z.string().min(1).optional(),
  scheduled_window: z.object({ start: z.string().min(1), end: z.string().min(1) }).nullable().optional(),
  last_checked_at: z.string().min(1).optional(),
});
export type ResidentOrderThread = z.infer<typeof ResidentOrderThreadSchema>;

/* One per feature request the resident filed (docs/16 §5.4): their memory of it, and the check on GET_FEATURE_REQUEST. */
export const ResidentFeatureRequestThreadSchema = z.object({
  persona_id: z.string().min(1),
  sk: z.string().regex(/^FEATURE_REQUEST#.+$/),
  feature_request_id: z.string().min(1),
  title: z.string().min(1),
  filed_by_idea_id: z.string().min(1),
  last_known_status: z.string().min(1),
  last_known_status_reason: z.string().nullable(),
  last_checked_at: z.string().min(1),
  created_at: z.string().min(1),
});
export type ResidentFeatureRequestThread = z.infer<typeof ResidentFeatureRequestThreadSchema>;

/* What a step changes in the resident's memory, written in the step's own transaction. */
export type ThreadWrite =
  | { kind: "ORDER_CHECKED"; order_id: string; status: string; scheduled_window: { start: string; end: string } | null; at: string }
  | { kind: "FEATURE_REQUEST_FILED"; feature_request_id: string; title: string; idea_id: string; status: string; status_reason: string | null; at: string }
  | { kind: "FEATURE_REQUEST_CHECKED"; feature_request_id: string; status: string; status_reason: string | null; at: string };

export const IDEA_SK_PREFIX = "IDEA#";
export const THREAD_SK_PREFIX = "ORDER#";
export const FEATURE_REQUEST_THREAD_SK_PREFIX = "FEATURE_REQUEST#";

export function featureRequestThreadSortKey(featureRequestId: string): string {
  return `${FEATURE_REQUEST_THREAD_SK_PREFIX}${featureRequestId}`;
}

export function ideaSortKey(ideaId: string): string {
  return `${IDEA_SK_PREFIX}${ideaId}`;
}

/** A step's sort key: under its idea's, so one query returns the idea and then its steps in order. */
export function stepSortKey(ideaId: string, sequence: number): string {
  return `${ideaSortKey(ideaId)}#STEP#${String(sequence).padStart(4, "0")}`;
}

export function threadSortKey(orderId: string): string {
  return `${THREAD_SK_PREFIX}${orderId}`;
}

export function byOrderKey(personaId: string, orderId: string): string {
  return `${personaId}#${orderId}`;
}
