import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo } from "../../logger";
import { OperatorDao } from "../../dao/operator/operatorDao";
import { OrderDao } from "../../dao/order/orderDao";
import { LocationDao } from "../../dao/location/locationDao";
import type { FleetLocations } from "../../models/fleetLocation";
import { HOME_DEPOT_LOCATION, type GpsLocation } from "../../models/gpsLocation";
import type { Location } from "../../models/location";

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
function getDefaultOrderDao(): OrderDao {
  return new OrderDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("ORDERS_TABLE_NAME"));
}
function getDefaultLocationDao(): LocationDao {
  return new LocationDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("LOCATIONS_TABLE_NAME"));
}

/* Same "fall back to the depot when a Location record has no lat/lng" rule as orderSchedulingService.ts's resolveJobLocation. */
function toGpsLocation(location: Location): GpsLocation {
  if (!location.latitude || !location.longitude) return HOME_DEPOT_LOCATION;
  return { lat: Number(location.latitude), lng: Number(location.longitude) };
}

export interface GetFleetLocationsDeps {
  operatorDao?: OperatorDao;
  orderDao?: OrderDao;
  locationDao?: LocationDao;
}

/**
 * This Operator's last-5-completed-jobs GPS trail
 * (`11-street-condition-implementation.md` §7), most-recent-first.
 * Skips an Order whose Location record can't be found — a data anomaly,
 * not a reason to fail the whole map.
 */
async function getRecentJobLocations(orderDao: OrderDao, locationDao: LocationDao, operatorId: string): Promise<GpsLocation[]> {
  const recentOrders = await orderDao.listRecentResolvedOrdersForOperator(operatorId);
  const locations = await Promise.all(recentOrders.map((order) => locationDao.getLocation(order.location_id)));
  return locations.filter((location): location is Location => location !== null).map(toGpsLocation);
}

/**
 * `GET /fleet/locations` (`10-capacity-modeling-and-integration.md` §6.1)
 * — the public read path behind the home-page map. Returns the
 * public-safe subset of each active Operator (§6.1's
 * `FleetOperatorLocation`), plus its `recent_job_locations` trail
 * (`11-street-condition-implementation.md` §7).
 */
export async function getFleetLocations(deps: GetFleetLocationsDeps = {}): Promise<FleetLocations> {
  const operatorDao = deps.operatorDao ?? getDefaultOperatorDao();
  const orderDao = deps.orderDao ?? getDefaultOrderDao();
  const locationDao = deps.locationDao ?? getDefaultLocationDao();
  logInfo("GetFleetLocationsStarted", {});

  const roster = await operatorDao.listActiveRoster();
  const operators = await Promise.all(
    roster.map(async (operator) => ({
      operator_id: operator.operator_id,
      name: operator.name,
      current_activity: operator.current_activity,
      current_location: operator.current_location,
      recent_job_locations: await getRecentJobLocations(orderDao, locationDao, operator.operator_id),
    }))
  );

  logInfo("GetFleetLocationsCompleted", { operatorCount: operators.length });
  return { operators };
}
