import { logInfo } from "../../logger";
import { requireEnv } from "../../env";
import { createDocumentClient } from "../../dynamoClient";
import { LocationDao } from "../../dao/location/locationDao";
import type { Location } from "../../models/location";

/* Lazily constructed per CLAUDE.md §5.2 — never a module-scope singleton. */
function getLocationDao(): LocationDao {
  return new LocationDao(createDocumentClient(), requireEnv("LOCATIONS_TABLE_NAME"));
}

export interface LocationServiceDeps {
  locationDao?: LocationDao;
}

/** One Location by id, or `null` when none exists. */
export async function getLocation(locationId: string, deps: LocationServiceDeps = {}): Promise<Location | null> {
  const locationDao = deps.locationDao ?? getLocationDao();
  const location = await locationDao.getLocation(locationId);
  if (!location) {
    logInfo("LocationNotFound", { locationId });
    return null;
  }
  logInfo("LocationFetched", { locationId, borough: location.borough });
  return location;
}
