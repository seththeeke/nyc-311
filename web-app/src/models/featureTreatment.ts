import { z } from "zod";

/*
 * `POST /feature-flags/{flag_key}/treatment` (11-street-condition-implementation.md
 * §4.2) — the bureau's public flag evaluation, as the web-app reads it.
 */
export const FeatureTreatmentSchema = z.object({
  flag_key: z.string().min(1),
  treatment: z.string().min(1),
});
export type FeatureTreatment = z.infer<typeof FeatureTreatmentSchema>;

/* Flags the web-app itself evaluates, and the treatment that turns each one on. */
export const CUSTOMERS_TAB_FLAG = "CUSTOMERS_TAB";
export const CUSTOMERS_TAB_ON = "T1";
