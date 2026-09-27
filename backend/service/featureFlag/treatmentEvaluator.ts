import {
  ENTITY_TYPE_CONTEXT_FIELD,
  type FeatureFlag,
  type TreatmentContext,
  type TreatmentReason,
} from "../../models/featureFlag";

export interface TreatmentDecision {
  treatment: string;
  reason: TreatmentReason;
}

/**
 * Pure treatment choice per `11-street-condition-implementation.md` §4.3:
 * a matching override wins, then a random draw walks the allocations
 * cumulatively, and whatever remains gets the default.
 *
 * @param random - Returns a value in [0, 1); injectable for tests.
 */
export function evaluateTreatment(
  flag: FeatureFlag,
  context: TreatmentContext,
  random: () => number = Math.random
): TreatmentDecision {
  for (const override of flag.overrides) {
    if (context[ENTITY_TYPE_CONTEXT_FIELD[override.entity_type]] === override.entity_id) {
      return { treatment: override.treatment, reason: "OVERRIDE" };
    }
  }

  const draw = random() * 100;
  let cumulative = 0;
  for (const allocation of flag.allocations) {
    cumulative += allocation.percent;
    if (draw < cumulative) {
      return { treatment: allocation.treatment, reason: "ALLOCATION" };
    }
  }

  return { treatment: flag.default_treatment, reason: "DEFAULT" };
}
