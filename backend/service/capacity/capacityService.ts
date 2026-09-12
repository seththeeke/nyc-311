import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { OperatorDao } from "../../dao/operator/operatorDao";
import type { Operator } from "../../models/operator";
import type { CapacityStatus } from "../../models/capacityStatus";
import { NotFoundError, ValidationError } from "../../models/errors";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Constructed lazily inside each exported function, not at module scope — per CLAUDE.md §5.2. */
function getDefaultOperatorDao(): OperatorDao {
  return new OperatorDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("OPERATORS_TABLE_NAME"));
}

/**
 * Placeholder business input, same spirit as `MOCK_TRANSIT_MINUTES` etc.
 * — exact value TBD (`10-capacity-modeling-and-integration.md` §1.2). All
 * vehicles seeded by `test-scripts/7-seed-capacity.py` take this default,
 * satisfying "10 vehicles of a fixed cost."
 */
export const DEFAULT_OPERATOR_RATE_PER_HOUR = 45;

export interface AddCapacityDeps {
  operatorDao?: OperatorDao;
}

/** `POST /capacity` (§2.1) — always a new `operator_id`, never reactivates a retired one. */
export async function addCapacity(
  name: string,
  ratePerHour: number | undefined,
  deps: AddCapacityDeps = {}
): Promise<Operator> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  const rate = ratePerHour ?? DEFAULT_OPERATOR_RATE_PER_HOUR;

  logInfo("AddCapacityStarted", { name, ratePerHour: rate });
  const operator = await operatorDao.addOperator(name, rate);
  logInfo("AddCapacityCompleted", { operatorId: operator.operator_id, name, ratePerHour: rate });
  return operator;
}

export interface RemoveCapacityDeps {
  operatorDao?: OperatorDao;
}

/**
 * `DELETE /capacity/{operator_id}` (§2.1) — finalizes immediately for an
 * already-idle Operator, or queues removal for a busy one (finalized once
 * its current execution resolves — Leg 3, not yet built, so in practice
 * every removal finalizes immediately today). Idempotent for an
 * already-queued removal.
 *
 * @throws {@link NotFoundError} if `operatorId` doesn't exist.
 * @throws {@link ValidationError} if the Operator is already retired.
 */
export async function removeCapacity(operatorId: string, deps: RemoveCapacityDeps = {}): Promise<Operator> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  logInfo("RemoveCapacityStarted", { operatorId });

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

  if (operator.current_activity === "IDLE") {
    const finalized = await operatorDao.finalizeRemoval(operatorId);
    logInfo("RemoveCapacityFinalizedImmediately", { operatorId });
    return finalized;
  }

  const queued = await operatorDao.queueRemoval(operatorId);
  logInfo("RemoveCapacityQueued", { operatorId, currentActivity: operator.current_activity });
  return queued;
}

export interface GetCapacityStatusDeps {
  operatorDao?: OperatorDao;
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
  };
  logInfo("GetCapacityStatusCompleted", { fleetSize: status.fleet_size, availableCount: status.available_count });
  return status;
}
