import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFleetLocations } from "../../src/hooks/useFleetLocations";
import { fleetLocationService } from "../../src/services/fleetLocationService";
import type { FleetLocations } from "../../src/models/fleetLocation";

vi.mock("../../src/services/fleetLocationService", () => ({
  fleetLocationService: { getFleetLocations: vi.fn() },
}));

const mockedGetFleetLocations = vi.mocked(fleetLocationService.getFleetLocations);

const locations: FleetLocations = {
  operators: [{ operator_id: "01OPERATOR", name: "Truck 12", current_activity: "IDLE", current_location: { lat: 40.7128, lng: -74.006 } }],
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGetFleetLocations.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFleetLocations", () => {
  it("resolves locations from the service", async () => {
    mockedGetFleetLocations.mockResolvedValue(locations);

    const { result } = renderHook(() => useFleetLocations(), { wrapper });

    await waitFor(() => expect(result.current.locations).toEqual(locations));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a failure as an error state", async () => {
    mockedGetFleetLocations.mockRejectedValue(new Error("HTTP 500"));

    const { result } = renderHook(() => useFleetLocations(), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe("HTTP 500"));
  });
});
