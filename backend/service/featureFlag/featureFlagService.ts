import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { FeatureFlagDao } from "../../dao/featureFlag/featureFlagDao";
import { NotFoundError } from "../../models/errors";
import type {
  CreateFeatureFlagRequest,
  FeatureFlag,
  TreatmentContext,
  UpdateFeatureFlagRequest,
} from "../../models/featureFlag";
import { evaluateTreatment } from "./treatmentEvaluator";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/* Lazily constructed per CLAUDE.md §5.2 — never a module-scope singleton. */
function getFeatureFlagDao(): FeatureFlagDao {
  return new FeatureFlagDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("FEATURE_FLAGS_TABLE_NAME"));
}

export interface FeatureFlagServiceDeps {
  featureFlagDao?: FeatureFlagDao;
  now?: () => Date;
  /** Returns a value in [0, 1); drives the allocation draw. */
  random?: () => number;
}

export async function listFeatureFlags(deps: FeatureFlagServiceDeps = {}): Promise<FeatureFlag[]> {
  const dao = deps.featureFlagDao ?? getFeatureFlagDao();
  const flags = await dao.listFlags();
  flags.sort((a, b) => a.flag_key.localeCompare(b.flag_key));
  logInfo("FeatureFlagsListed", { count: flags.length, flagKeys: flags.map((flag) => flag.flag_key) });
  return flags;
}

/** @throws {@link NotFoundError} if no flag exists at `flagKey`. */
export async function getFeatureFlag(flagKey: string, deps: FeatureFlagServiceDeps = {}): Promise<FeatureFlag> {
  const dao = deps.featureFlagDao ?? getFeatureFlagDao();
  const flag = await dao.getFlag(flagKey);
  if (!flag) {
    logInfo("FeatureFlagNotFound", { flagKey });
    throw new NotFoundError(`No feature flag ${flagKey}`);
  }
  logInfo("FeatureFlagFetched", { flagKey, version: flag.version });
  return flag;
}

/** @throws {@link TerminalError} if the key is already taken. */
export async function createFeatureFlag(
  request: CreateFeatureFlagRequest,
  userId: string,
  deps: FeatureFlagServiceDeps = {}
): Promise<FeatureFlag> {
  const dao = deps.featureFlagDao ?? getFeatureFlagDao();
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const flag: FeatureFlag = { ...request, version: 1, created_at: now, updated_at: now, updated_by: userId };
  logInfo("FeatureFlagCreating", { flagKey: flag.flag_key, userId });
  await dao.createFlag(flag);
  logInfo("FeatureFlagCreated", { flagKey: flag.flag_key });
  return flag;
}

/**
 * Replaces a flag's whole config and bumps its version (§4 Q5).
 *
 * @throws {@link NotFoundError} if the flag doesn't exist.
 * @throws {@link TerminalError} if `expected_version` is stale.
 */
export async function updateFeatureFlag(
  flagKey: string,
  request: UpdateFeatureFlagRequest,
  userId: string,
  deps: FeatureFlagServiceDeps = {}
): Promise<FeatureFlag> {
  const dao = deps.featureFlagDao ?? getFeatureFlagDao();
  const existing = await getFeatureFlag(flagKey, { featureFlagDao: dao });
  const { expected_version: expectedVersion, ...config } = request;
  const updated: FeatureFlag = {
    ...config,
    flag_key: flagKey,
    version: expectedVersion + 1,
    created_at: existing.created_at,
    updated_at: (deps.now ?? (() => new Date()))().toISOString(),
    updated_by: userId,
  };
  logInfo("FeatureFlagUpdating", { flagKey, expectedVersion, storedVersion: existing.version, userId });
  await dao.replaceFlag(updated, expectedVersion);
  logInfo("FeatureFlagUpdated", { flagKey, version: updated.version });
  return updated;
}

/** @throws {@link NotFoundError} if the flag doesn't exist. */
export async function deleteFeatureFlag(flagKey: string, userId: string, deps: FeatureFlagServiceDeps = {}): Promise<void> {
  const dao = deps.featureFlagDao ?? getFeatureFlagDao();
  logInfo("FeatureFlagDeleting", { flagKey, userId });
  const existed = await dao.deleteFlag(flagKey);
  if (!existed) {
    logInfo("FeatureFlagDeleteNotFound", { flagKey });
    throw new NotFoundError(`No feature flag ${flagKey}`);
  }
  logInfo("FeatureFlagDeleted", { flagKey });
}

/**
 * The HTTP `getTreatment` path: resolves the flag and chooses a
 * treatment, logging why (§4 Q6 — the reason is never returned).
 *
 * @throws {@link NotFoundError} if the flag doesn't exist.
 */
export async function evaluateFeatureFlag(
  flagKey: string,
  context: TreatmentContext,
  deps: FeatureFlagServiceDeps = {}
): Promise<string> {
  const flag = await getFeatureFlag(flagKey, deps);
  const decision = evaluateTreatment(flag, context, deps.random);
  logInfo("TreatmentEvaluated", {
    flagKey,
    treatment: decision.treatment,
    reason: decision.reason,
    flagVersion: flag.version,
    context,
  });
  return decision.treatment;
}

export interface GetTreatmentOptions {
  /** Returned when the flag doesn't exist, so a missing flag never breaks the caller. */
  fallback: string;
}

/**
 * In-process entry point for backend callers (§4 Q3/Q4) — same choice as
 * {@link evaluateFeatureFlag}, but a missing flag yields `fallback` with a
 * WARN instead of throwing. Other failures (DynamoDB errors) still throw.
 */
export async function getTreatment(
  flagKey: string,
  context: TreatmentContext,
  options: GetTreatmentOptions,
  deps: FeatureFlagServiceDeps = {}
): Promise<string> {
  try {
    return await evaluateFeatureFlag(flagKey, context, deps);
  } catch (err) {
    if (err instanceof NotFoundError) {
      logWarn("TreatmentFallbackUsed", { flagKey, fallback: options.fallback, context });
      return options.fallback;
    }
    throw err;
  }
}
