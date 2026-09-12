import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { OperatorDao } from "../../dao/operator/operatorDao";
import type { FleetLocations } from "../../models/fleetLocation";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* Constructed lazily inside getFleetLocations, not at module scope — per CLAUDE.md §5.2. */
function getDefaultOperatorDao(): OperatorDao {
  return new OperatorDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("OPERATORS_TABLE_NAME"));
}

export interface GetFleetLocationsDeps {
  operatorDao?: OperatorDao;
}

/**
 * `GET /fleet/locations` (`10-capacity-modeling-and-integration.md` §6.1)
 * — the public read path behind the home-page map. Reuses the same
 * `listActiveRoster` query `getCapacityStatus` uses, but returns only the
 * public-safe subset of each Operator (§6.1's `FleetOperatorLocation`) —
 * a separate service from `capacityService` since this is a genuinely
 * different concern (public read vs. admin CRUD), not just a filtered
 * view of the same one.
 */
export async function getFleetLocations(deps: GetFleetLocationsDeps = {}): Promise<FleetLocations> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  logInfo("GetFleetLocationsStarted", {});

  const roster = await operatorDao.listActiveRoster();
  const operators = roster.map((operator) => ({
    operator_id: operator.operator_id,
    name: operator.name,
    current_activity: operator.current_activity,
    current_location: operator.current_location,
  }));

  logInfo("GetFleetLocationsCompleted", { operatorCount: operators.length });
  return { operators };
}
