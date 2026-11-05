import { z } from "zod";

/*
 * `POST /feature-flags/{flag_key}/treatment` (11-street-condition-implementation.md
 * §4.2) — the public flag evaluation, as the web-app reads it.
 */
export const FeatureTreatmentSchema = z.object({
  flag_key: z.string().min(1),
  treatment: z.string().min(1),
});
export type FeatureTreatment = z.infer<typeof FeatureTreatmentSchema>;

/* MEET_THE_TEAM gates the Meet the Team page (#146): C hides it, T1 shows it. */
export const MEET_THE_TEAM_FLAG = "MEET_THE_TEAM";
export const MEET_THE_TEAM_ON = "T1";

/* CONTACTS_PAGE gates the Residents page's Contacts tab (docs/17 §17.3): C hides it, T1 shows it. */
export const CONTACTS_PAGE_FLAG = "CONTACTS_PAGE";
export const CONTACTS_PAGE_ON = "T1";

/* MARKETING_PAGE puts the marketing page at / ahead of the map: C keeps the map, T1 shows the page. */
export const MARKETING_PAGE_FLAG = "MARKETING_PAGE";
export const MARKETING_PAGE_ON = "T1";

/* AGENT_CONTRIBUTIONS gates Meet the Team's View Contributions button and panel: C hides them, T1 shows them. */
export const AGENT_CONTRIBUTIONS_FLAG = "AGENT_CONTRIBUTIONS";
export const AGENT_CONTRIBUTIONS_ON = "T1";
