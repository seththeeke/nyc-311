import { z } from "zod";

/*
 * Mirrors backend/models/featureFlag.ts (11-street-condition-implementation.md
 * §4.1): one entity serves as both feature flag and experiment. The same
 * cross-field rules run client-side so the Admin editor can show problems
 * before a save round-trip.
 */

export const ENTITY_TYPES = ["OPERATOR"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

const IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const IDENTIFIER_MESSAGE = "Must be ALL_CAPS (A-Z, 0-9, _), max 64 chars";

export const FeatureFlagOverrideSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().min(1, "Entity id is required"),
  treatment: z.string().regex(IDENTIFIER_PATTERN, IDENTIFIER_MESSAGE),
});
export type FeatureFlagOverride = z.infer<typeof FeatureFlagOverrideSchema>;

export const FeatureFlagAllocationSchema = z.object({
  treatment: z.string().regex(IDENTIFIER_PATTERN, IDENTIFIER_MESSAGE),
  percent: z.number().int("Percent must be a whole number").min(1, "Percent must be 1-100").max(100, "Percent must be 1-100"),
});
export type FeatureFlagAllocation = z.infer<typeof FeatureFlagAllocationSchema>;

const ConfigShape = {
  description: z.string().max(500, "Description is capped at 500 characters"),
  treatments: z
    .array(z.string().regex(IDENTIFIER_PATTERN, IDENTIFIER_MESSAGE))
    .min(1, "At least one treatment is required")
    .max(10, "At most 10 treatments"),
  default_treatment: z.string().min(1, "Pick a default treatment"),
  overrides: z.array(FeatureFlagOverrideSchema),
  allocations: z.array(FeatureFlagAllocationSchema),
};

interface Config {
  treatments: string[];
  default_treatment: string;
  overrides: FeatureFlagOverride[];
  allocations: FeatureFlagAllocation[];
}

function refineConfig(config: Config, ctx: z.RefinementCtx): void {
  const declared = new Set(config.treatments);
  const issue = (message: string): void => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (declared.size !== config.treatments.length) issue("Treatments must be unique");
  if (!declared.has(config.default_treatment)) issue("Default must be one of the treatments");
  const targets = new Set<string>();
  for (const override of config.overrides) {
    if (!declared.has(override.treatment)) issue(`Override for ${override.entity_id} uses an undeclared treatment`);
    const target = `${override.entity_type}#${override.entity_id}`;
    if (targets.has(target)) issue(`Duplicate override for ${override.entity_id}`);
    targets.add(target);
  }
  const allocated = new Set<string>();
  for (const allocation of config.allocations) {
    if (!declared.has(allocation.treatment)) issue(`Allocation uses an undeclared treatment ${allocation.treatment}`);
    if (allocated.has(allocation.treatment)) issue(`Duplicate allocation for ${allocation.treatment}`);
    allocated.add(allocation.treatment);
  }
  if (config.allocations.reduce((sum, allocation) => sum + allocation.percent, 0) > 100) {
    issue("Allocations must sum to 100 or less");
  }
}

export const FeatureFlagInputSchema = z.object(ConfigShape).strict().superRefine(refineConfig);
export type FeatureFlagInput = z.infer<typeof FeatureFlagInputSchema>;

export const FlagKeySchema = z.string().regex(IDENTIFIER_PATTERN, `Flag key: ${IDENTIFIER_MESSAGE}`);

export const FeatureFlagSchema = z.object({
  flag_key: FlagKeySchema,
  ...ConfigShape,
  version: z.number().int().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  updated_by: z.string().min(1),
});
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export const FeatureFlagListSchema = z.object({ flags: z.array(FeatureFlagSchema) });
export type FeatureFlagList = z.infer<typeof FeatureFlagListSchema>;

export type CreateFeatureFlagRequest = FeatureFlagInput & { flag_key: string };
export type UpdateFeatureFlagRequest = FeatureFlagInput & { expected_version: number };
