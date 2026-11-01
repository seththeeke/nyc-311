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
