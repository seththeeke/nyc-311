import { createHash } from "node:crypto";
import { ResidentDao } from "../../dao/resident/residentDao";
import { createDocumentClient } from "../../dynamoClient";
import { requireEnv } from "../../env";
import { logInfo } from "../../logger";
import { ValidationError } from "../../models/errors";
import {
  RESIDENT_CURRENT_SK,
  RESIDENT_ROSTER_PK,
  ResidentSeedSchema,
  versionSortKey,
  type ResidentContent,
  type ResidentSeed,
} from "../../models/resident";
import { ACTION_PROMPT_VERSION, buildActionPrompt } from "./actionPrompt";
import { IDEA_PROMPT_VERSION, buildIdeaPrompt } from "./ideaPrompt";

/* Constructed lazily (CLAUDE.md §5.2) — never a module-scope singleton. */
function getResidentDao(): ResidentDao {
  return new ResidentDao(createDocumentClient(), requireEnv("RESIDENTS_TABLE_NAME"));
}

export interface ResidentSyncDeps {
  residentDao?: ResidentDao;
  now?: () => Date;
}

export type ResidentSyncOutcome = "CREATED" | "NEW_VERSION" | "UNCHANGED";

/* JSON with keys sorted at every level, so the hash depends only on content. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A seed plus its assembled prompt and the hash of both — what one version freezes. */
export function buildResidentContent(seed: ResidentSeed): ResidentContent {
  const withPrompt = {
    ...seed,
    idea_prompt: buildIdeaPrompt(seed),
    prompt_version: IDEA_PROMPT_VERSION,
    action_prompt: buildActionPrompt(seed),
    action_prompt_version: ACTION_PROMPT_VERSION,
  };
  const contentHash = `sha256:${createHash("sha256").update(canonicalJson(withPrompt)).digest("hex")}`;
  return { ...withPrompt, content_hash: contentHash };
}

/** @throws {@link ValidationError} if any seed is malformed or two share a `persona_id`. */
export function parseSeeds(rawSeeds: unknown[]): ResidentSeed[] {
  const seeds = rawSeeds.map((raw, i) => {
    const parsed = ResidentSeedSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(`Resident seed ${i} is invalid`, parsed.error.issues);
    return parsed.data;
  });
  const ids = seeds.map((seed) => seed.persona_id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) throw new ValidationError(`Two resident seeds share persona_id ${duplicate}`);
  return seeds;
}

/**
 * Brings `Residents` in line with the seed files (§2 customer side,
 * decision 2): a new seed becomes version 1; a changed one gets the next
 * version; an unchanged one is left alone. A resident whose seed was
 * removed is never deleted — its ideas still point at it.
 */
export async function syncResidents(rawSeeds: unknown[], deps: ResidentSyncDeps = {}): Promise<Record<string, ResidentSyncOutcome>> {
  const seeds = parseSeeds(rawSeeds);
  const dao = deps.residentDao ?? getResidentDao();
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const outcomes: Record<string, ResidentSyncOutcome> = {};
  for (const seed of seeds) {
    const content = buildResidentContent(seed);
    const current = await dao.getCurrent(seed.persona_id);
    if (!current) {
      await dao.createResident(
        { ...content, sk: versionSortKey(1), version: 1, created_at: now },
        { ...content, sk: RESIDENT_CURRENT_SK, version: 1, roster_pk: RESIDENT_ROSTER_PK, idea_count: 0, last_idea_at: null, created_at: now, updated_at: now }
      );
      outcomes[seed.persona_id] = "CREATED";
    } else if (current.content_hash === content.content_hash) {
      outcomes[seed.persona_id] = "UNCHANGED";
    } else {
      const version = current.version + 1;
      await dao.addVersion({ ...content, sk: versionSortKey(version), version, created_at: now }, content, now);
      outcomes[seed.persona_id] = "NEW_VERSION";
    }
    logInfo("ResidentSynced", { personaId: seed.persona_id, outcome: outcomes[seed.persona_id], contentHash: content.content_hash });
  }
  return outcomes;
}
