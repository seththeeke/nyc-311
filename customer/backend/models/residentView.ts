import { z } from "zod";
import { ACTION_TYPES, IDEA_TYPES } from "./resident";
import { ACTION_STATUSES, IDEA_STATUSES } from "./residentIdea";

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
  status: z.enum(IDEA_STATUSES),
  created_at: z.string().min(1),
  model_id: z.string().min(1),
  prompt_version: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  actions: z.array(z.object({ type: z.enum(ACTION_TYPES), status: z.enum(ACTION_STATUSES) }).passthrough()),
});
export type ResidentIdeaView = z.infer<typeof ResidentIdeaViewSchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
