import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { requireEnv } from "../../env";
import { OperatorDao } from "../../dao/operator/operatorDao";
import { OrderDao } from "../../dao/order/orderDao";
import { LocationDao } from "../../dao/location/locationDao";
import type { FleetLocations, FleetCurrentOrder } from "../../models/fleetLocation";
import { HOME_DEPOT_LOCATION, type GpsLocation } from "../../models/gpsLocation";
import type { Location } from "../../models/location";
import type { Order } from "../../models/order";

/*
 * Constructed lazily inside getFleetLocations, not at module scope — per CLAUDE.md §5.2.
 * The three default DAOs share one client (one connection pool, one set of TLS handshakes)
 * and it's destroyed at the end of the call so sockets don't pile up across warm invocations.
 */
function getDefaultClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}));
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
 * The on-click detail for the Order an Operator is currently executing
 * (§7's on-click enrichment) — `null` if its Location record can't be
 * found, a data anomaly, not a reason to fail the whole map.
 */
function buildCurrentOrderDetail(order: Order | null, locations: Map<string, Location>): FleetCurrentOrder | null {
  if (!order) return null;
  const location = order.location_id === null ? undefined : locations.get(order.location_id);
  if (!location) {
    logWarn("GetFleetLocationsCurrentOrderLocationMissing", { orderId: order.order_id, locationId: order.location_id });
    return null;
  }
  return { order_id: order.order_id, complaint_type: order.complaint_type, location_address: location.address };
}

/**
 * The last-5-completed-jobs GPS trail (`11-street-condition-implementation.md`
 * §7). Skips a recent job whose Location record can't be found — a data
 * anomaly, not a reason to fail the whole map.
 */
function buildRecentJobLocations(orders: Order[], locations: Map<string, Location>): GpsLocation[] {
  return orders
    .map((order) => (order.location_id === null ? undefined : locations.get(order.location_id)))
    .filter((location): location is Location => location !== undefined)
    .map(toGpsLocation);
}

/**
 * `GET /fleet/locations` (`10-capacity-modeling-and-integration.md` §6.1)
 * — the public read path behind the home-page map. Returns the
 * public-safe subset of each active Operator (§6.1's
 * `FleetOperatorLocation`), plus its `recent_job_locations` trail and
 * `current_order` on-click detail (`11-street-condition-implementation.md` §7).
 * Every Order's Location is resolved in one batched lookup, not one GetItem
 * per job — the per-job fan-out made this route CPU-bound (~7s at 70 Operators).
 */
export async function getFleetLocations(deps: GetFleetLocationsDeps = {}): Promise<FleetLocations> {
  let client: DynamoDBDocumentClient | undefined;
  const sharedClient = (): DynamoDBDocumentClient => (client ??= getDefaultClient());
  try {
    const operatorDao = deps.operatorDao ?? new OperatorDao(sharedClient(), requireEnv("OPERATORS_TABLE_NAME"));
    const orderDao = deps.orderDao ?? new OrderDao(sharedClient(), requireEnv("ORDERS_TABLE_NAME"));
    const locationDao = deps.locationDao ?? new LocationDao(sharedClient(), requireEnv("LOCATIONS_TABLE_NAME"));
    logInfo("GetFleetLocationsStarted", {});

    const roster = await operatorDao.listActiveRoster();
    logInfo("GetFleetLocationsRosterLoaded", { operatorCount: roster.length });

    const activities = await Promise.all(roster.map((operator) => orderDao.getOperatorOrderActivity(operator.operator_id)));
    const locationIds = activities
      .flatMap(({ currentOrder, recentCompletedOrders }) => [
        ...(currentOrder ? [currentOrder.location_id] : []),
        ...recentCompletedOrders.map((order) => order.location_id),
      ])
      .filter((locationId): locationId is string => locationId !== null);
    logInfo("GetFleetLocationsOrderActivityLoaded", { locationIdCount: locationIds.length });

    const locations = locationIds.length > 0 ? await locationDao.getLocations(locationIds) : new Map<string, Location>();
    logInfo("GetFleetLocationsLocationsLoaded", { requested: new Set(locationIds).size, found: locations.size });

    const operators = roster.map((operator, index) => {
      const { currentOrder, recentCompletedOrders } = activities[index];
      return {
        operator_id: operator.operator_id,
        name: operator.name,
        current_activity: operator.current_activity,
        current_location: operator.current_location,
        recent_job_locations: buildRecentJobLocations(recentCompletedOrders, locations),
        current_order: buildCurrentOrderDetail(currentOrder, locations),
      };
    });

    logInfo("GetFleetLocationsCompleted", { operatorCount: operators.length });
    return { operators };
  } finally {
    client?.destroy();
  }
}
