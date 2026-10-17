import { z } from "zod";

/*
 * A simulated resident (13-customer-simulation.md §2, Appendix B) as the
 * customer stack's read API returns it (Appendix M/O). Dials are 0-100.
 */

const DialSchema = z.number().int().min(0).max(100);
const HourSchema = z.number().int().min(0).max(23);

export const ResidentPersonaSchema = z.object({
  persona_id: z.string().min(1),
  version: z.number().int().min(1),
  name: z.string().min(1),
  /* One line on who they are, for the list. */
  tagline: z.string().min(1),
  backstory: z.string().min(1),
  persona_prompt: z.string().min(1),
  /* The Bedrock model the resident thinks with. */
  model_id: z.string().min(1),
  demeanor: z.object({ patience: DialSchema, hostility: DialSchema, verbosity: DialSchema }),
  activity_level: DialSchema,
  /* New York hours; `start > end` means the window runs overnight. */
  active_hours: z.object({ start: HourSchema, end: HourSchema }),
  follow_up_propensity: DialSchema,
  /* `descriptors` are kinds of street problem, e.g. "Cave-in". */
  interests: z.object({ boroughs: z.array(z.string().min(1)), descriptors: z.array(z.string().min(1)) }),
  idea_count: z.number().int().min(0),
  last_idea_at: z.string().min(1).nullable(),
});
export type ResidentPersona = z.infer<typeof ResidentPersonaSchema>;

/* `GET /residents` — paginated with an opaque cursor. */
export const ResidentPersonaPageSchema = z.object({
  items: z.array(ResidentPersonaSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type ResidentPersonaPage = z.infer<typeof ResidentPersonaPageSchema>;
