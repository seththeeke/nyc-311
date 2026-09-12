import { config } from "../config";
import { FleetLocationsSchema, type FleetLocations } from "../models/fleetLocation";
import { MOCK_FLEET_LOCATIONS } from "../test-data/fleetLocations";

/*
 * One interface, two implementations, selected by config.dataMode
 * (CLAUDE.md §5.1) — the home-page map's data source
 * (10-capacity-modeling-and-integration.md §6.1). Public, unlike
 * capacityService — no auth header, matches orderService/pollerMetricsService.
 */
export interface FleetLocationService {
  getFleetLocations(): Promise<FleetLocations>;
}

class LiveFleetLocationService implements FleetLocationService {
  async getFleetLocations(): Promise<FleetLocations> {
    const response = await fetch(`${config.apiBaseUrl}/fleet/locations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch fleet locations: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    return FleetLocationsSchema.parse(body);
  }
}

class MockFleetLocationService implements FleetLocationService {
  async getFleetLocations(): Promise<FleetLocations> {
    return Promise.resolve(MOCK_FLEET_LOCATIONS);
  }
}

export const fleetLocationService: FleetLocationService =
  config.dataMode === "live" ? new LiveFleetLocationService() : new MockFleetLocationService();
