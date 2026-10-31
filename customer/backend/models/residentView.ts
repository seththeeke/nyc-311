import { z } from "zod";
import { IDEA_TYPES } from "./resident";
import { IdeaResolutionSchema, STEP_KINDS, StepDecisionSchema, StepExecutionSchema } from "./residentIdea";

/*
 * What the public read API returns (docs/13-customer-simulation.md §4,
 * Appendix K/M). The web-app parses these same shapes, so field names
 * follow its models. Storage-only fields (sort keys, index keys, hashes)
 * never leave the service.
 */

const Dial = z.number().int().min(0).max(100);

export const ResidentViewSchema = z.object({
  persona_id: z.string().min(1),
  version: z.number().int().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  backstory: z.string().min(1),
  persona_prompt: z.string().min(1),
  model_key: z.string().min(1).nullable(),
  model_id: z.string().min(1),
  demeanor: z.object({ patience: Dial, hostility: Dial, verbosity: Dial }),
  activity_level: Dial,
  active_hours: z.object({ start: z.number().int(), end: z.number().int() }),
  follow_up_propensity: Dial,
  interests: z.object({ boroughs: z.array(z.string()), descriptors: z.array(z.string()) }),
  idea_count: z.number().int().min(0),
  last_idea_at: z.string().min(1).nullable(),
});
export type ResidentView = z.infer<typeof ResidentViewSchema>;

export const IdeaAnchorViewSchema = z.object({
  order_id: z.string().min(1),
  external_unique_key: z.string().min(1),
  descriptor: z.string().min(1).nullable(),
  borough: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
});
export type IdeaAnchorView = z.infer<typeof IdeaAnchorViewSchema>;

export const ResidentIdeaViewSchema = z.object({
  idea_id: z.string().min(1),
  persona_id: z.string().min(1),
  persona_version: z.number().int().min(1),
  idea_type: z.enum(IDEA_TYPES),
  text: z.string().min(1),
  anchor: IdeaAnchorViewSchema.nullable(),
  resolution: IdeaResolutionSchema,
  created_at: z.string().min(1),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
});
export type ResidentIdeaView = z.infer<typeof ResidentIdeaViewSchema>;

/* One workstream step as the read API returns it: the stored step without its keys (docs/16 §5.3). */
export const IdeaStepViewSchema = z.object({
  sequence: z.number().int().min(1),
  kind: z.enum(STEP_KINDS),
  decision: StepDecisionSchema.nullable(),
  execution: StepExecutionSchema.nullable(),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  created_at: z.string().min(1),
});
export type IdeaStepView = z.infer<typeof IdeaStepViewSchema>;

/* `GET /residents/{id}/ideas/{ideaId}`: the idea with its whole workstream, from one query. */
export const ResidentIdeaDetailViewSchema = ResidentIdeaViewSchema.extend({
  steps: z.array(IdeaStepViewSchema),
});
export type ResidentIdeaDetailView = z.infer<typeof ResidentIdeaDetailViewSchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
