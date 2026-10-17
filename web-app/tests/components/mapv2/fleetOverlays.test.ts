import { describe, expect, it, vi } from "vitest";
import type { Map as MapLibreMap } from "maplibre-gl";
import { SITE_SOURCE, syncOverlays, toOverlayData, TRAIL_SOURCE } from "../../../src/components/mapv2/fleetOverlays";
import type { FleetOperatorLocation } from "../../../src/models/fleetLocation";

const working: FleetOperatorLocation = {
  operator_id: "W",
  name: "Vehicle W",
  current_activity: "WORKING",
  current_location: { lat: 40.7, lng: -73.9 },
  recent_job_locations: [
    { lat: 40.71, lng: -73.91 },
    { lat: 40.72, lng: -73.92 },
  ],
  current_order: null,
};
const noGps: FleetOperatorLocation = { ...working, operator_id: "X", current_location: null };

describe("toOverlayData", () => {
  it("draws the selected truck's trail as fading legs, newest first", () => {
    const { trails, sites } = toOverlayData([working, noGps], "W");
    expect(trails.features).toHaveLength(2);
    expect(trails.features[0].geometry.coordinates).toEqual([[-73.9, 40.7], [-73.91, 40.71]]);
    expect(trails.features[0].properties.opacity).toBeGreaterThan(trails.features[1].properties.opacity);
    expect(trails.features[0].properties.color).toBe("#3b82f6");
    expect(sites.features.map((f) => f.properties.opacity)).toEqual([0.9, 0.9 - 0.16]);
  });

  it("gives unselected trucks no trail and faint job sites, and skips trucks without GPS", () => {
    const { trails, sites } = toOverlayData([working, noGps], null);
    expect(trails.features).toHaveLength(0);
    expect(sites.features).toHaveLength(2);
    expect(sites.features.every((f) => f.properties.opacity === 0.3)).toBe(true);
  });
});

function fakeMap(existing: boolean) {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Set<string>();
  const map = {
    getSource: vi.fn((id: string) => sources.get(id)),
    addSource: vi.fn((id: string) => sources.set(id, { setData: vi.fn() })),
    getLayer: vi.fn((id: string) => (layers.has(id) ? {} : undefined)),
    addLayer: vi.fn((layer: { id: string }) => layers.add(layer.id)),
  };
  if (existing) {
    sources.set(TRAIL_SOURCE, { setData: vi.fn() });
    sources.set(SITE_SOURCE, { setData: vi.fn() });
    ["mapv2-trail-glow", "mapv2-trail", "mapv2-site-glow", "mapv2-site"].forEach((id) => layers.add(id));
  }
  return { map, sources };
}

describe("syncOverlays", () => {
  const data = toOverlayData([working], "W");

  it("adds the sources and layers under the given layer, then fills them", () => {
    const { map, sources } = fakeMap(false);
    syncOverlays(map as unknown as MapLibreMap, data, "building-3d");
    expect(map.addSource).toHaveBeenCalledTimes(2);
    expect(map.addLayer).toHaveBeenCalledTimes(4);
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "mapv2-trail" }), "building-3d");
    expect(sources.get(TRAIL_SOURCE)?.setData).toHaveBeenCalledWith(data.trails);
    expect(sources.get(SITE_SOURCE)?.setData).toHaveBeenCalledWith(data.sites);
  });

  it("only refreshes data when everything already exists", () => {
    const { map, sources } = fakeMap(true);
    syncOverlays(map as unknown as MapLibreMap, data, undefined);
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
    expect(sources.get(TRAIL_SOURCE)?.setData).toHaveBeenCalledTimes(1);
  });
});
