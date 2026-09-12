import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("fleetLocationService — mock mode", () => {
  it("returns the baked mock fleet locations", async () => {
    vi.stubEnv("VITE_DATA_MODE", "mock");
    const { fleetLocationService } = await import("../../src/services/fleetLocationService");
    const { MOCK_FLEET_LOCATIONS } = await import("../../src/test-data/fleetLocations");

    await expect(fleetLocationService.getFleetLocations()).resolves.toEqual(MOCK_FLEET_LOCATIONS);
  });
});

describe("fleetLocationService — live mode", () => {
  it("fetches /fleet/locations with no auth header and parses the response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
    const body = { operators: [] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal("fetch", fetchMock);

    const { fleetLocationService } = await import("../../src/services/fleetLocationService");
    const result = await fleetLocationService.getFleetLocations();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/fleet/locations");
    expect(result).toEqual(body);
  });

  it("throws a descriptive error on a non-2xx response", async () => {
    vi.stubEnv("VITE_DATA_MODE", "live");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { fleetLocationService } = await import("../../src/services/fleetLocationService");

    await expect(fleetLocationService.getFleetLocations()).rejects.toThrow("Failed to fetch fleet locations: HTTP 500");
  });
});
