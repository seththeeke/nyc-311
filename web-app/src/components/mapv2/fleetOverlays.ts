import type { FeatureCollection, LineString, Point } from "geojson";
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { FleetOperatorLocation, GpsLocation } from "../../models/fleetLocation";
import { ACTIVITY_COLOR } from "../fleetActivityStyle";

/*
 * Ground-level fleet overlays drawn by MapLibre rather than Three.js:
 * the selected truck's fading trail through its last jobs, and a glow
 * under every past job site. Only the selection gets a trail — the whole
 * fleet's cross-borough history at once is an unreadable web.
 */

export const TRAIL_SOURCE = "mapv2-trails";
export const SITE_SOURCE = "mapv2-sites";

interface OverlayProps {
  color: string;
  opacity: number;
}

export interface FleetOverlayData {
  trails: FeatureCollection<LineString, OverlayProps>;
  sites: FeatureCollection<Point, OverlayProps>;
}

/** Newest leg brightest; each older leg fades by this much. */
const FADE_STEP = 0.16;
const NEWEST_OPACITY = 0.9;
/** Everyone else's past job sites stay as faint dots, so the city still shows where work has been. */
const BACKGROUND_SITE_OPACITY = 0.3;

function lngLat(location: GpsLocation): [number, number] {
  return [location.lng, location.lat];
}

/** Splits the selected trail into legs so each can carry its own fade — MapLibre can't vary opacity along one line per feature. */
export function toOverlayData(operators: FleetOperatorLocation[], selectedId: string | null): FleetOverlayData {
  const trails: FleetOverlayData["trails"] = { type: "FeatureCollection", features: [] };
  const sites: FleetOverlayData["sites"] = { type: "FeatureCollection", features: [] };
  for (const operator of operators) {
    if (!operator.current_location) continue;
    const color = ACTIVITY_COLOR[operator.current_activity];
    const selected = operator.operator_id === selectedId;
    const path = selected ? [operator.current_location, ...operator.recent_job_locations] : [];
    for (let i = 0; i < path.length - 1; i += 1) {
      trails.features.push({
        type: "Feature",
        properties: { color, opacity: Math.max(0.12, NEWEST_OPACITY - i * FADE_STEP) },
        geometry: { type: "LineString", coordinates: [lngLat(path[i]), lngLat(path[i + 1])] },
      });
    }
    operator.recent_job_locations.forEach((site, i) => {
      sites.features.push({
        type: "Feature",
        properties: { color, opacity: selected ? Math.max(0.15, NEWEST_OPACITY - i * FADE_STEP) : BACKGROUND_SITE_OPACITY },
        geometry: { type: "Point", coordinates: lngLat(site) },
      });
    });
  }
  return { trails, sites };
}

const OVERLAY_LAYERS: LayerSpecification[] = [
  {
    id: "mapv2-trail-glow",
    type: "line",
    source: TRAIL_SOURCE,
    layout: { "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-opacity": ["*", 0.35, ["get", "opacity"]], "line-width": 9, "line-blur": 6 },
  },
  {
    id: "mapv2-trail",
    type: "line",
    source: TRAIL_SOURCE,
    layout: { "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-opacity": ["get", "opacity"], "line-width": 2, "line-dasharray": [2, 1.5] },
  },
  {
    id: "mapv2-site-glow",
    type: "circle",
    source: SITE_SOURCE,
    paint: { "circle-color": ["get", "color"], "circle-opacity": ["*", 0.3, ["get", "opacity"]], "circle-radius": 11, "circle-blur": 0.8 },
  },
  {
    id: "mapv2-site",
    type: "circle",
    source: SITE_SOURCE,
    paint: {
      "circle-color": ["get", "color"],
      "circle-opacity": ["get", "opacity"],
      "circle-radius": 3.5,
      "circle-stroke-width": 1,
      "circle-stroke-color": ["get", "color"],
      "circle-pitch-alignment": "map",
    },
  },
];

/** Adds the overlay sources/layers if a style (re)load dropped them, then fills them; safe to call repeatedly. */
export function syncOverlays(map: MapLibreMap, data: FleetOverlayData, beforeLayerId: string | undefined): void {
  if (!map.getSource(TRAIL_SOURCE)) map.addSource(TRAIL_SOURCE, { type: "geojson", data: data.trails });
  if (!map.getSource(SITE_SOURCE)) map.addSource(SITE_SOURCE, { type: "geojson", data: data.sites });
  for (const layer of OVERLAY_LAYERS) {
    if (!map.getLayer(layer.id)) map.addLayer(layer, beforeLayerId);
  }
  (map.getSource(TRAIL_SOURCE) as GeoJSONSource).setData(data.trails);
  (map.getSource(SITE_SOURCE) as GeoJSONSource).setData(data.sites);
}
