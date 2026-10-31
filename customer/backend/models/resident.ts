import { z } from "zod";

/*
 * A simulated resident (docs/13-customer-simulation.md §2 customer side,
 * decisions 1-3 and 7; §3 Flow B). One table, two row shapes: `CURRENT`,
 * the live row with its counters, and an immutable `V#nnnn` copy per
 * version. Both carry the full content, including the assembled prompt,
 * so an idea's `persona_version` names exactly what the model was sent.
 */

export const IDEA_TYPES = ["STATUS_CHECK", "SERVICED_CHECK", "ETA_REQUEST", "PRIORITY_INQUIRY", "ESCALATION", "FEATURE_REQUEST"] as const;
export type IdeaType = (typeof IDEA_TYPES)[number];

/* The tools a resident can use on an idea, named for the public API operation each calls (docs/16 §5.1). */
export const ACTION_TYPES = ["SEARCH_REQUESTS", "CREATE_FEATURE_REQUEST", "GET_FEATURE_REQUEST", "BROWSE_WEBSITE"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/* Tools are granted in buckets, named for the public resource they act on. WEBSITE is reserved for RPA. */
export const ACTION_BUCKETS = ["REQUESTS", "FEATURE_REQUESTS", "WEBSITE"] as const;
export type ActionBucket = (typeof ACTION_BUCKETS)[number];

export const ACTION_BUCKET_TOOLS: Record<ActionBucket, ActionType[]> = {
  REQUESTS: ["SEARCH_REQUESTS"],
  FEATURE_REQUESTS: ["CREATE_FEATURE_REQUEST", "GET_FEATURE_REQUEST"],
  WEBSITE: ["BROWSE_WEBSITE"],
};

const Dial = z.number().int().min(0).max(100);
const Hour = z.number().int().min(0).max(23);

const ResidentSeedShape = z.object({
  persona_id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  tagline: z.string().min(1),
  backstory: z.string().min(1),
  persona_prompt: z.string().min(1),
  /* Names the resident's bundled Three.js model in the web-app; null shows the initial. */
  model_key: z.string().min(1).nullable(),
  /* The Bedrock model this resident thinks with. */
  model_id: z.string().min(1),
  /* How often the resident thinks about ideas: an EventBridge Scheduler cron, New York time. */
  schedule: z.string().regex(/^cron\(.+\)$/),
  demeanor: z.object({ patience: Dial, hostility: Dial, verbosity: Dial }),
  /* Chance that one scheduled thought becomes an idea. */
  activity_level: Dial,
  active_hours: z.object({ start: Hour, end: Hour }),
  follow_up_propensity: Dial,
  idea_type_weights: z.object({
    STATUS_CHECK: Dial,
    SERVICED_CHECK: Dial,
    ETA_REQUEST: Dial,
    PRIORITY_INQUIRY: Dial,
    ESCALATION: Dial,
    FEATURE_REQUEST: Dial,
  }),
  /* Order `descriptor` values, e.g. "Cave-in" — every order's complaint type is the same "Street Condition". */
  interests: z.object({ boroughs: z.array(z.string().min(1)), descriptors: z.array(z.string().min(1)) }),
  action_buckets: z.array(z.enum(ACTION_BUCKETS)),
  /* Preference among granted tools, described to the model; never a code-side roll. */
  action_weights: z.object({ SEARCH_REQUESTS: Dial, CREATE_FEATURE_REQUEST: Dial, GET_FEATURE_REQUEST: Dial, BROWSE_WEBSITE: Dial }),
});

/* One seed file in `residents/` — strict, so a typo in a hand-edited seed fails the sync and the tests. */
export const ResidentSeedSchema = ResidentSeedShape.strict();
export type ResidentSeed = z.infer<typeof ResidentSeedSchema>;

/* Everything a version freezes: the seed, plus the prompts assembled from it and the hash the sync compares. */
export const ResidentContentSchema = ResidentSeedShape.extend({
  idea_prompt: z.string().min(1).max(8000),
  prompt_version: z.string().min(1),
  /* The action loop's system prompt (docs/16 §5.2). */
  action_prompt: z.string().min(1).max(8000),
  action_prompt_version: z.string().min(1),
  content_hash: z.string().min(1),
});
export type ResidentContent = z.infer<typeof ResidentContentSchema>;

export const RESIDENT_CURRENT_SK = "CURRENT";
/* Every CURRENT row carries this, so the sparse Roster index lists residents without a scan. */
export const RESIDENT_ROSTER_PK = "ALL";

export const ResidentCurrentSchema = ResidentContentSchema.extend({
  sk: z.literal(RESIDENT_CURRENT_SK),
  version: z.number().int().min(1),
  roster_pk: z.literal(RESIDENT_ROSTER_PK),
  idea_count: z.number().int().min(0),
  last_idea_at: z.string().min(1).nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type ResidentCurrent = z.infer<typeof ResidentCurrentSchema>;

/*
 * The slice of a CURRENT row the seed sync compares: which version it is and
 * what content it holds. Read on its own so a row written under an older
 * content shape can still be brought up to date.
 */
export const ResidentCurrentVersionSchema = z.object({
  version: z.number().int().min(1),
  content_hash: z.string().min(1),
});
export type ResidentCurrentVersion = z.infer<typeof ResidentCurrentVersionSchema>;

export const ResidentVersionSchema = ResidentContentSchema.extend({
  sk: z.string().regex(/^V#\d{4,}$/),
  version: z.number().int().min(1),
  created_at: z.string().min(1),
});
export type ResidentVersion = z.infer<typeof ResidentVersionSchema>;

/** `V#0003` for version 3 — zero-padded so versions sort in order. */
export function versionSortKey(version: number): string {
  return `V#${String(version).padStart(4, "0")}`;
}
