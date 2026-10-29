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

/*
 * MAP_V2 gates Mapv2, the 3-D city map: T1 shows it alongside the classic
 * map, T2 makes it the map — the classic entry and `/` give way to it.
 */
export const MAP_V2_FLAG = "MAP_V2";
export const MAP_V2_ON = "T1";
export const MAP_V2_TAKEOVER = "T2";
