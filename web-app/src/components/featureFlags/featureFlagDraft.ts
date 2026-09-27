import {
  FeatureFlagInputSchema,
  FlagKeySchema,
  type FeatureFlag,
  type FeatureFlagAllocation,
  type FeatureFlagInput,
  type FeatureFlagOverride,
} from "../../models/featureFlag";

/* Editable form state for one flag; treatments are edited as comma-separated text. */
export interface FeatureFlagDraft {
  flag_key: string;
  description: string;
  treatmentsText: string;
  default_treatment: string;
  overrides: FeatureFlagOverride[];
  allocations: FeatureFlagAllocation[];
}

export function emptyDraft(): FeatureFlagDraft {
  return { flag_key: "", description: "", treatmentsText: "ON, OFF", default_treatment: "OFF", overrides: [], allocations: [] };
}

export function toDraft(flag: FeatureFlag): FeatureFlagDraft {
  return {
    flag_key: flag.flag_key,
    description: flag.description,
    treatmentsText: flag.treatments.join(", "),
    default_treatment: flag.default_treatment,
    overrides: flag.overrides,
    allocations: flag.allocations,
  };
}

export function parseTreatments(text: string): string[] {
  return text
    .split(",")
    .map((treatment) => treatment.trim())
    .filter((treatment) => treatment.length > 0);
}

export function draftToInput(draft: FeatureFlagDraft): FeatureFlagInput {
  return {
    description: draft.description,
    treatments: parseTreatments(draft.treatmentsText),
    default_treatment: draft.default_treatment,
    overrides: draft.overrides,
    allocations: draft.allocations,
  };
}

/** Every problem that would make the API reject this draft, de-duplicated, in display order. */
export function draftIssues(draft: FeatureFlagDraft, isNew: boolean): string[] {
  const issues: string[] = [];
  if (isNew) {
    const key = FlagKeySchema.safeParse(draft.flag_key);
    if (!key.success) issues.push(...key.error.issues.map((issue) => issue.message));
  }
  const input = FeatureFlagInputSchema.safeParse(draftToInput(draft));
  if (!input.success) issues.push(...input.error.issues.map((issue) => issue.message));
  return [...new Set(issues)];
}

/** Share of traffic the default treatment receives once every allocation is taken. */
export function defaultShare(allocations: FeatureFlagAllocation[]): number {
  return 100 - allocations.reduce((sum, allocation) => sum + (Number.isFinite(allocation.percent) ? allocation.percent : 0), 0);
}

export function summarizeAllocations(allocations: FeatureFlagAllocation[]): string {
  return allocations.length === 0 ? "—" : allocations.map((allocation) => `${allocation.treatment} ${allocation.percent}%`).join(", ");
}
