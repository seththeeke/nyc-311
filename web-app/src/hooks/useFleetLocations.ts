import { useQuery } from "@tanstack/react-query";
import { fleetLocationService } from "../services/fleetLocationService";
import type { FleetLocations } from "../models/fleetLocation";

const FLEET_LOCATIONS_QUERY_KEY = ["fleetLocations"];

/** Keeps the home-page map reasonably live without a manual refresh. */
const REFETCH_INTERVAL_MS = 15_000;

export interface UseFleetLocationsResult {
  locations: FleetLocations | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Components call hooks, never services, directly (CLAUDE.md §5.1). Backs
 * the home-page `FleetMap` (`10-capacity-modeling-and-integration.md`
 * §6.1) — public, no auth, unlike `useCapacity`.
 */
export function useFleetLocations(): UseFleetLocationsResult {
  const {
    data: locations,
    isLoading,
    error,
  } = useQuery<FleetLocations, Error>({
    queryKey: FLEET_LOCATIONS_QUERY_KEY,
    queryFn: () => fleetLocationService.getFleetLocations(),
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  return { locations, isLoading, error: error ?? null };
}
