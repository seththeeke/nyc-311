import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { ThemeName } from "../../models/theme";

/*
 * Mapv2's own MapLibre style over OpenFreeMap's OpenMapTiles vector tiles
 * (free, no API key): a quiet base so the extruded city and the fleet
 * carry the picture. DARK is a night city, LIGHT a porcelain model.
 */

export const OPENFREEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const BASE_SOURCE = "openmaptiles";
/* NYC Open Data's borough boundaries (gthc-hcne, shoreline-clipped), simplified with mapshaper; served from public/ and made absolute, since MapLibre fetches it from its worker. */
export const BOROUGH_SOURCE = "nyc-boroughs";
const BOROUGH_DATA_PATH = "/nyc-boroughs.geojson";

interface Palette {
  background: string;
  water: string;
  park: string;
  roadMinor: string;
  roadMajor: string;
  roadHighway: string;
  buildingLow: string;
  buildingMid: string;
  buildingHigh: string;
  buildingTop: string;
  buildingOpacity: number;
  label: string;
  labelHalo: string;
  sky: string;
  horizon: string;
  fog: string;
  light: string;
  lightIntensity: number;
  /** One tint per borough, keyed by NYC's `borocode` (1 Manhattan … 5 Staten Island). */
  boroughs: readonly [string, string, string, string, string];
  boroughFillOpacity: number;
}

export const PALETTES: Record<ThemeName, Palette> = {
  DARK: {
    background: "#070b14",
    water: "#0a1d31",
    park: "#0c1c1a",
    roadMinor: "#141d2e",
    roadMajor: "#1d2a42",
    roadHighway: "#274069",
    buildingLow: "#121a2b",
    buildingMid: "#1a2742",
    buildingHigh: "#263c66",
    buildingTop: "#3a5c99",
    buildingOpacity: 0.94,
    label: "#6d7fa3",
    labelHalo: "#070b14",
    sky: "#08122a",
    horizon: "#1b3768",
    fog: "#070b14",
    light: "#9db8ff",
    lightIntensity: 0.35,
    boroughs: ["#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24"],
    boroughFillOpacity: 0.16,
  },
  LIGHT: {
    background: "#eef1f5",
    water: "#bcd5ea",
    park: "#d8e9d6",
    roadMinor: "#ffffff",
    roadMajor: "#fbfcfd",
    roadHighway: "#fde6c4",
    buildingLow: "#e6eaf0",
    buildingMid: "#d9dfe8",
    buildingHigh: "#c9d3e2",
    buildingTop: "#b4c3da",
    buildingOpacity: 0.97,
    label: "#5b6880",
    labelHalo: "#ffffff",
    sky: "#cfe2f7",
    horizon: "#f5f8fc",
    fog: "#eef1f5",
    light: "#ffffff",
    lightIntensity: 0.45,
    boroughs: ["#0891b2", "#7c3aed", "#db2777", "#059669", "#d97706"],
    boroughFillOpacity: 0.12,
  },
};

/* MapLibre only allows ["zoom"] in a top-level interpolate, so each road class scales the stops, not the expression. */
function roadWidth(scale: number): ExpressionSpecification {
  return ["interpolate", ["exponential", 1.6], ["zoom"], 10, 0.4 * scale, 14, 2 * scale, 18, 18 * scale];
}

function road(id: string, classes: string[], color: string, widthScale: number, minzoom: number): LayerSpecification {
  return {
    id,
    type: "line",
    source: BASE_SOURCE,
    "source-layer": "transportation",
    minzoom,
    filter: ["in", ["get", "class"], ["literal", classes]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": roadWidth(widthScale) },
  };
}

function boroughColor(p: Palette): ExpressionSpecification {
  return ["match", ["get", "borocode"], "1", p.boroughs[0], "2", p.boroughs[1], "3", p.boroughs[2], "4", p.boroughs[3], p.boroughs[4]];
}

/* Strongest at the city overview, so the boroughs read apart; fades to a hint once streets and buildings take over. */
function boroughFill(p: Palette): LayerSpecification {
  return {
    id: "borough-fill",
    type: "fill",
    source: BOROUGH_SOURCE,
    paint: {
      "fill-color": boroughColor(p),
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, p.boroughFillOpacity, 13, p.boroughFillOpacity * 0.5, 15, 0.03],
    },
  };
}

function boroughOutline(p: Palette): LayerSpecification {
  return {
    id: "borough-outline",
    type: "line",
    source: BOROUGH_SOURCE,
    layout: { "line-join": "round" },
    paint: {
      "line-color": boroughColor(p),
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 14, 2.5],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.85, 15, 0.35],
      "line-blur": 0.6,
    },
  };
}

function baseLayers(p: Palette): LayerSpecification[] {
  return [
    { id: "background", type: "background", paint: { "background-color": p.background } },
    {
      id: "park",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "park",
      paint: { "fill-color": p.park, "fill-opacity": 0.9 },
    },
    {
      id: "landcover-grass",
      type: "fill",
      source: BASE_SOURCE,
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "wood"]]],
      paint: { "fill-color": p.park, "fill-opacity": 0.7 },
    },
    { id: "water", type: "fill", source: BASE_SOURCE, "source-layer": "water", paint: { "fill-color": p.water } },
    boroughFill(p),
    road("road-minor", ["minor", "service", "track"], p.roadMinor, 0.6, 13),
    road("road-major", ["primary", "secondary", "tertiary", "trunk"], p.roadMajor, 1, 10),
    road("road-highway", ["motorway"], p.roadHighway, 1.3, 8),
    boroughOutline(p),
  ];
}

function buildingLayer(p: Palette): LayerSpecification {
  return {
    id: "building-3d",
    type: "fill-extrusion",
    source: BASE_SOURCE,
    "source-layer": "building",
    minzoom: 13,
    filter: ["!=", ["get", "hide_3d"], true],
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["coalesce", ["get", "render_height"], 0],
        0,
        p.buildingLow,
        40,
        p.buildingMid,
        150,
        p.buildingHigh,
        350,
        p.buildingTop,
      ],
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": p.buildingOpacity,
      "fill-extrusion-vertical-gradient": true,
    },
  };
}

function placeLabels(p: Palette): LayerSpecification {
  return {
    id: "place-label",
    type: "symbol",
    source: BASE_SOURCE,
    "source-layer": "place",
    filter: ["in", ["get", "class"], ["literal", ["city", "borough", "suburb", "neighbourhood"]]],
    layout: {
      "text-field": ["upcase", ["get", "name"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 13],
      "text-letter-spacing": 0.25,
      "text-max-width": 8,
    },
    paint: { "text-color": p.label, "text-halo-color": p.labelHalo, "text-halo-width": 1.2, "text-opacity": 0.85 },
  };
}

export function buildMapStyle(theme: ThemeName): StyleSpecification {
  const p = PALETTES[theme];
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      [BASE_SOURCE]: { type: "vector", url: OPENFREEMAP_TILEJSON },
      [BOROUGH_SOURCE]: { type: "geojson", data: new URL(BOROUGH_DATA_PATH, window.location.origin).href, attribution: "Borough boundaries: NYC Open Data" },
    },
    sky: {
      "sky-color": p.sky,
      "horizon-color": p.horizon,
      "fog-color": p.fog,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.25,
    },
    light: { anchor: "map", position: [1.4, 200, 35], color: p.light, intensity: p.lightIntensity },
    layers: [...baseLayers(p), buildingLayer(p), placeLabels(p)],
  };
}
