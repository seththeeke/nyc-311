import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import { createDocumentClient } from "../../dynamoClient";
import { OperatorDao } from "../../dao/operator/operatorDao";
import type { Operator } from "../../models/operator";
import type { CapacityStatus } from "../../models/capacityStatus";
import { ADMIN_CAPACITY_CHANGE, type CapacityChange } from "../../models/capacityChange";
import type { CapacityLimits } from "../../models/capacitySnapshot";
import { ConflictError, NotFoundError, ValidationError } from "../../models/errors";
import { addDays, newYorkDate } from "../analytics/newYorkWeek";

/* Constructed lazily inside each exported function, not at module scope — per CLAUDE.md §5.2. */
function getDefaultOperatorDao(): OperatorDao {
  return new OperatorDao(createDocumentClient(), requireEnv("OPERATORS_TABLE_NAME"));
}

/**
 * Placeholder business input, same spirit as `MOCK_TRANSIT_MINUTES` etc.
 * — exact value TBD (`10-capacity-modeling-and-integration.md` §1.2). All
 * vehicles seeded by `test-scripts/7-seed-capacity.py` take this default,
 * satisfying "10 vehicles of a fixed cost."
 */
export const DEFAULT_OPERATOR_RATE_PER_HOUR = 45;

/* The COO's daily caps (docs/17-executive-team.md §12.3); the admin isn't capped. */
export const MAX_AGENT_RECRUITS_PER_DAY = 2;
export const MAX_AGENT_RELEASES_PER_DAY = 2;

export interface CapacityLimitsDeps {
  operatorDao?: OperatorDao;
  now?: () => Date;
}

/**
 * Today's agent recruits and releases against the caps, counted from the
 * whole roster (retired operators included) by New York day. Two calls
 * racing could both pass; the COO runs one at a time.
 */
export async function getCapacityLimits(deps: CapacityLimitsDeps = {}): Promise<CapacityLimits> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  const now = deps.now ? deps.now() : new Date();
  const day = newYorkDate(now);
  const roster = await operatorDao.listRoster();
  const onDay = (iso: string | null | undefined): boolean => !!iso && newYorkDate(new Date(iso)) === day;
  const limits: CapacityLimits = {
    max_recruits_per_day: MAX_AGENT_RECRUITS_PER_DAY,
    max_releases_per_day: MAX_AGENT_RELEASES_PER_DAY,
    recruits_today: roster.filter((operator) => operator.added_by === "AGENT" && onDay(operator.start_datetime)).length,
    releases_today: roster.filter((operator) => operator.released_by === "AGENT" && onDay(operator.released_at)).length,
    day,
    day_resets_at: `${addDays(day, 1)} 00:00 America/New_York`,
  };
  logInfo("GetCapacityLimitsCompleted", { limits });
  return limits;
}

/**
 * Refuses an agent change past today's cap.
 *
 * @throws {@link ConflictError} naming the cap that was hit.
 */
async function enforceAgentLimit(kind: "RECRUIT" | "RELEASE", change: CapacityChange, deps: CapacityLimitsDeps): Promise<void> {
  if (change.actor !== "AGENT") return;
  const limits = await getCapacityLimits(deps);
  const [used, max] = kind === "RECRUIT" ? [limits.recruits_today, limits.max_recruits_per_day] : [limits.releases_today, limits.max_releases_per_day];
  if (used >= max) {
    logInfo("CapacityAgentLimitReached", { kind, used, max });
    throw new ConflictError(`Daily ${kind === "RECRUIT" ? "recruit" : "release"} limit reached: ${used} of ${max} today; resets ${limits.day_resets_at}`);
  }
}

export interface AddCapacityDeps {
  operatorDao?: OperatorDao;
  now?: () => Date;
}

/** `POST /capacity` (§2.1) — always a new `operator_id`, never reactivates a retired one. */
export async function addCapacity(
  name: string,
  ratePerHour: number | undefined,
  deps: AddCapacityDeps = {},
  change: CapacityChange = ADMIN_CAPACITY_CHANGE
): Promise<Operator> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  const rate = ratePerHour ?? DEFAULT_OPERATOR_RATE_PER_HOUR;

  logInfo("AddCapacityStarted", { name, ratePerHour: rate, change });
  await enforceAgentLimit("RECRUIT", change, { operatorDao, now: deps.now });
  const operator = await operatorDao.addOperator(name, rate, change);
  logInfo("AddCapacityCompleted", { operatorId: operator.operator_id, name, ratePerHour: rate });
  return operator;
}

export interface RemoveCapacityDeps {
  operatorDao?: OperatorDao;
  now?: () => Date;
}

/**
 * `DELETE /capacity/{operator_id}` (§2.1) — finalizes immediately for an
 * already-idle Operator, or queues removal for a busy one (finalized by
 * `orderExecutionService.resolveOrder` once its current execution
 * resolves). Idempotent for an already-queued removal.
 *
 * @throws {@link NotFoundError} if `operatorId` doesn't exist.
 * @throws {@link ValidationError} if the Operator is already retired.
 */
export async function removeCapacity(operatorId: string, deps: RemoveCapacityDeps = {}, change: CapacityChange = ADMIN_CAPACITY_CHANGE): Promise<Operator> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  logInfo("RemoveCapacityStarted", { operatorId, change });

  const operator = await operatorDao.getOperator(operatorId);
  if (!operator) {
    logInfo("RemoveCapacityNotFound", { operatorId });
    throw new NotFoundError(`No Operator found for operator_id ${operatorId}`);
  }
  if (operator.status === "INACTIVE") {
    logInfo("RemoveCapacityAlreadyRemoved", { operatorId });
    throw new ValidationError(`Operator ${operatorId} is already removed`);
  }
  if (operator.removal_requested_at) {
    logInfo("RemoveCapacityAlreadyQueued", { operatorId });
    return operator;
  }

  await enforceAgentLimit("RELEASE", change, { operatorDao, now: deps.now });
  if (operator.current_activity === "IDLE") {
    const finalized = await operatorDao.finalizeRemoval(operatorId, change);
    logInfo("RemoveCapacityFinalizedImmediately", { operatorId });
    return finalized;
  }

  const queued = await operatorDao.queueRemoval(operatorId, change);
  logInfo("RemoveCapacityQueued", { operatorId, currentActivity: operator.current_activity });
  return queued;
}

export interface GetCapacityStatusDeps {
  operatorDao?: OperatorDao;
  now?: () => Date;
}

/** `GET /capacity` (§2.1/§2.3) — live stats computed from the active roster query only, not folded event history. */
export async function getCapacityStatus(deps: GetCapacityStatusDeps = {}): Promise<CapacityStatus> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  logInfo("GetCapacityStatusStarted", {});

  const roster = await operatorDao.listActiveRoster();
  const availableCount = roster.filter(
    (operator) => operator.current_activity === "IDLE" && !operator.removal_requested_at
  ).length;
  const hourlyBurnRate = roster.reduce((sum, operator) => sum + operator.rate_per_hour, 0);

  const status: CapacityStatus = {
    available_count: availableCount,
    fleet_size: roster.length,
    hourly_burn_rate: hourlyBurnRate,
    roster,
    limits: await getCapacityLimits({ operatorDao, now: deps.now }),
  };
  logInfo("GetCapacityStatusCompleted", { fleetSize: status.fleet_size, availableCount: status.available_count });
  return status;
}
