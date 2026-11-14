import { logInfo } from "../../logger";
import type { LocationDao } from "../../dao/location/locationDao";
import { getLocationDao } from "../../dao/location/getLocationDao";
import type { Location } from "../../models/location";

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
