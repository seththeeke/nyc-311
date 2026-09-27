import { z } from "zod";

/*
 * 11-street-condition-implementation.md §4 — one entity serves as both a
 * feature flag and an experiment: named treatments, a default, per-entity
 * overrides, and a multi-way percentage split. Enum values ALL_CAPS per
 * CLAUDE.md §6.
 */

/* Which context field an override matches against; grows as TreatmentContext does. */
export const ENTITY_TYPES = ["OPERATOR"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/* Why a treatment was chosen — logged only, never returned (§4 Q6). */
export const TREATMENT_REASONS = ["OVERRIDE", "ALLOCATION", "DEFAULT"] as const;
export type TreatmentReason = (typeof TREATMENT_REASONS)[number];

const IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const MAX_TREATMENTS = 10;
const MAX_DESCRIPTION_LENGTH = 500;

export const FlagKeySchema = z.string().regex(IDENTIFIER_PATTERN, "Must be ALL_CAPS (A-Z, 0-9, _), max 64 chars");
const TreatmentNameSchema = z.string().regex(IDENTIFIER_PATTERN, "Must be ALL_CAPS (A-Z, 0-9, _), max 64 chars");

export const FeatureFlagOverrideSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().min(1),
  treatment: TreatmentNameSchema,
});
export type FeatureFlagOverride = z.infer<typeof FeatureFlagOverrideSchema>;

export const FeatureFlagAllocationSchema = z.object({
  treatment: TreatmentNameSchema,
  percent: z.number().int().min(1).max(100),
});
export type FeatureFlagAllocation = z.infer<typeof FeatureFlagAllocationSchema>;

const FeatureFlagConfigShape = {
  description: z.string().max(MAX_DESCRIPTION_LENGTH),
  treatments: z.array(TreatmentNameSchema).min(1).max(MAX_TREATMENTS),
  default_treatment: TreatmentNameSchema,
  overrides: z.array(FeatureFlagOverrideSchema),
  allocations: z.array(FeatureFlagAllocationSchema),
};

interface FeatureFlagConfig {
  treatments: string[];
  default_treatment: string;
  overrides: FeatureFlagOverride[];
  allocations: FeatureFlagAllocation[];
}

/**
 * Cross-field rules zod's per-field schemas can't express: unique
 * treatments, every referenced treatment declared, unique override
 * targets and allocation treatments, and allocations summing to ≤ 100.
 */
function refineConfig(config: FeatureFlagConfig, ctx: z.RefinementCtx): void {
  const declared = new Set(config.treatments);
  if (declared.size !== config.treatments.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["treatments"], message: "Treatments must be unique" });
  }
  if (!declared.has(config.default_treatment)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["default_treatment"], message: "Must be one of treatments" });
  }
  const overrideTargets = new Set<string>();
  config.overrides.forEach((override, index) => {
    if (!declared.has(override.treatment)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["overrides", index, "treatment"], message: "Must be one of treatments" });
    }
    const target = `${override.entity_type}#${override.entity_id}`;
    if (overrideTargets.has(target)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["overrides", index], message: "Duplicate override target" });
    }
    overrideTargets.add(target);
  });
  const allocated = new Set<string>();
  config.allocations.forEach((allocation, index) => {
    if (!declared.has(allocation.treatment)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["allocations", index, "treatment"], message: "Must be one of treatments" });
    }
    if (allocated.has(allocation.treatment)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["allocations", index], message: "Duplicate allocation treatment" });
    }
    allocated.add(allocation.treatment);
  });
  const total = config.allocations.reduce((sum, allocation) => sum + allocation.percent, 0);
  if (total > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["allocations"], message: "Allocations must sum to 100 or less" });
  }
}

export const FeatureFlagInputSchema = z.object(FeatureFlagConfigShape).strict().superRefine(refineConfig);
export type FeatureFlagInput = z.infer<typeof FeatureFlagInputSchema>;

export const CreateFeatureFlagRequestSchema = z
  .object({ flag_key: FlagKeySchema, ...FeatureFlagConfigShape })
  .strict()
  .superRefine(refineConfig);
export type CreateFeatureFlagRequest = z.infer<typeof CreateFeatureFlagRequestSchema>;

export const UpdateFeatureFlagRequestSchema = z
  .object({ expected_version: z.number().int().min(1), ...FeatureFlagConfigShape })
  .strict()
  .superRefine(refineConfig);
export type UpdateFeatureFlagRequest = z.infer<typeof UpdateFeatureFlagRequestSchema>;

export const FeatureFlagSchema = z
  .object({
    flag_key: FlagKeySchema,
    ...FeatureFlagConfigShape,
    version: z.number().int().min(1),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    updated_by: z.string().min(1),
  })
  .superRefine(refineConfig);
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export const FlagKeyParamsSchema = z.object({ flag_key: FlagKeySchema });

/* Strict so an unsupported context field fails loudly rather than being silently ignored. */
export const TreatmentContextSchema = z
  .object({
    operator_id: z.string().min(1).optional(),
  })
  .strict();
export type TreatmentContext = z.infer<typeof TreatmentContextSchema>;

export const TreatmentRequestSchema = z.object({ context: TreatmentContextSchema }).strict();
export type TreatmentRequest = z.infer<typeof TreatmentRequestSchema>;

export interface TreatmentResponse {
  flag_key: string;
  treatment: string;
}

/* Maps each entity type to the context field its overrides match on. */
export const ENTITY_TYPE_CONTEXT_FIELD: Record<EntityType, keyof TreatmentContext> = {
  OPERATOR: "operator_id",
};
