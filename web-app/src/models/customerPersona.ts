import { z } from "zod";

/*
 * A simulated resident (13-customer-simulation.md §2, Appendix B) as the
 * planned read API would return it. Captured shape, not yet reviewed —
 * the Residents page is a mock to decide what the API needs. Dials are
 * 0-100.
 */

const DialSchema = z.number().int().min(0).max(100);
const HourSchema = z.number().int().min(0).max(23);

export const CustomerPersonaSchema = z.object({
  persona_id: z.string().min(1),
  version: z.number().int().min(1),
  name: z.string().min(1),
  /* One line on who they are, for the list. */
  tagline: z.string().min(1),
  backstory: z.string().min(1),
  persona_prompt: z.string().min(1),
  demeanor: z.object({ patience: DialSchema, hostility: DialSchema, verbosity: DialSchema }),
  activity_level: DialSchema,
  /* New York hours; `start > end` means the window runs overnight. */
  active_hours: z.object({ start: HourSchema, end: HourSchema }),
  follow_up_propensity: DialSchema,
  interests: z.object({ boroughs: z.array(z.string().min(1)) }),
  idea_count: z.number().int().min(0),
  last_idea_at: z.string().min(1).nullable(),
});
export type CustomerPersona = z.infer<typeof CustomerPersonaSchema>;

/* `GET /customers` — paginated with an opaque cursor. */
export const CustomerPersonaPageSchema = z.object({
  items: z.array(CustomerPersonaSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type CustomerPersonaPage = z.infer<typeof CustomerPersonaPageSchema>;
