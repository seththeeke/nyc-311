import { logInfo, logWarn } from "../../logger";
import type { FeatureFlagDao } from "../../dao/featureFlag/featureFlagDao";
import { getFeatureFlagDao } from "../../dao/featureFlag/getFeatureFlagDao";
import { NotFoundError } from "../../models/errors";
import type {
  CreateFeatureFlagRequest,
  FeatureFlag,
  TreatmentContext,
  TreatmentReason,
  UpdateFeatureFlagRequest,
} from "../../models/featureFlag";
import { evaluateTreatment } from "./treatmentEvaluator";

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
  /** Returned on every failure (missing flag, failed read, unknown treatment), usually the control `C`. */
  fallback: string;
  /** The treatments the caller handles; any other evaluated treatment yields `fallback`. Omit to accept any. */
  treatments?: readonly string[];
}

/* Why a backend read fell back to the caller's `fallback`; logged as the `reason` field. */
export type FeatureFlagFallbackReason = "FLAG_MISSING" | "READ_FAILED" | "UNKNOWN_TREATMENT";

interface FeatureFlagReadFields {
  flagKey: string;
  reason: TreatmentReason | FeatureFlagFallbackReason;
  treatment: string;
  context: TreatmentContext;
  startedAtMs: number;
  now: () => Date;
  flagVersion?: number;
  evaluatedTreatment?: string;
  errorName?: string;
  errorMessage?: string;
}

/* The one `FeatureFlagRead` line per read (#202): the substrate of the Nyc311/FeatureFlags metric filters. */
function logFeatureFlagRead(fields: FeatureFlagReadFields): string {
  const { startedAtMs, now, ...rest } = fields;
  const outcome = fields.reason === "OVERRIDE" || fields.reason === "ALLOCATION" || fields.reason === "DEFAULT" ? "TREATMENT" : "FALLBACK";
  const line = {
    ...rest,
    outcome,
    durationMs: now().getTime() - startedAtMs,
    functionName: process.env["AWS_LAMBDA_FUNCTION_NAME"],
  };
  if (outcome === "TREATMENT") {
    logInfo("FeatureFlagRead", line);
  } else {
    logWarn("FeatureFlagRead", line);
  }
  return fields.treatment;
}

/**
 * In-process entry point for backend callers (§4 Q3/Q4, #202). Same choice
 * as {@link evaluateFeatureFlag}, but it never rejects: a missing flag, a
 * failed or malformed read, a missing table env var or a treatment outside
 * `options.treatments` all return `options.fallback` with a WARN. Every
 * call logs one `FeatureFlagRead` line with its outcome and duration.
 */
export async function getTreatment(
  flagKey: string,
  context: TreatmentContext,
  options: GetTreatmentOptions,
  deps: FeatureFlagServiceDeps = {}
): Promise<string> {
  const now = deps.now ?? (() => new Date());
  const startedAtMs = now().getTime();
  const base = { flagKey, context, startedAtMs, now };
  try {
    const dao = deps.featureFlagDao ?? getFeatureFlagDao();
    const flag = await dao.getFlag(flagKey);
    if (!flag) {
      return logFeatureFlagRead({ ...base, reason: "FLAG_MISSING", treatment: options.fallback });
    }
    const decision = evaluateTreatment(flag, context, deps.random);
    if (options.treatments && !options.treatments.includes(decision.treatment)) {
      return logFeatureFlagRead({
        ...base,
        reason: "UNKNOWN_TREATMENT",
        treatment: options.fallback,
        flagVersion: flag.version,
        evaluatedTreatment: decision.treatment,
      });
    }
    return logFeatureFlagRead({ ...base, reason: decision.reason, treatment: decision.treatment, flagVersion: flag.version });
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "UnknownError";
    const errorMessage = err instanceof Error ? err.message : String(err);
    return logFeatureFlagRead({
      ...base,
      reason: "READ_FAILED",
      treatment: options.fallback,
      errorName,
      errorMessage,
    });
  }
}
