import { type RefObject, useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { FleetOperatorLocation } from "../../models/fleetLocation";
import type { ThemeName } from "../../models/theme";
import { syncOverlays, toOverlayData } from "./fleetOverlays";
import { createSceneOrigin, NYC_CENTER } from "./geo";
import { buildMapStyle } from "./mapStyle";
import { easeInOutCubic } from "./truckMotion";
import { createFleetLayer, FLEET_LAYER_ID, type FleetLayer } from "./three/fleetLayer";
import { FleetScene } from "./three/fleetScene";

/*
 * Owns the MapLibre map and the Three.js fleet inside it for one mount:
 * creates both, re-adds the fleet and overlays whenever a style (re)load
 * drops them (a theme switch reloads the style), and feeds each poll in.
 */

export interface CityMapRuntime {
  map: MapLibreMap;
  fleet: FleetScene;
  layer: FleetLayer;
}

/*
 * The home view: the whole fleet across the boroughs, tilted. Buildings
 * only exist from tile zoom 13 (OpenMapTiles), so they rise as you zoom in.
 */
export const OVERVIEW = { center: [-73.94, 40.7] as [number, number], zoom: 11.2, pitch: 50, bearing: -20 };
/** Where the establishing shot starts: high and flat, swinging round into the overview. */
const ESTABLISHING = { zoom: 9.6, pitch: 0, bearing: -50 };
const INTRO_MS = 4200;
/* Overlays sit under the buildings so towers occlude trails the way they occlude streets. */
const OVERLAYS_BEFORE = "building-3d";

/*
 * MapLibre finds its worker next to its own module URL, which bundling
 * (Vite's dev pre-bundle and the production build alike) breaks; point it
 * at the self-contained worker file, which Vite serves/emits as an asset.
 */
setWorkerUrl(maplibreWorkerUrl);

export function frameClock(): number {
  return performance.now();
}

export function useCityMap(
  containerRef: RefObject<HTMLDivElement | null>,
  theme: ThemeName,
  operators: FleetOperatorLocation[],
  selectedId: string | null,
  reducedMotion: boolean
): CityMapRuntime | null {
  const [runtime, setRuntime] = useState<CityMapRuntime | null>(null);
  const overlayData = useRef(toOverlayData(operators, selectedId));
  const appliedTheme = useRef(theme);
  const initial = useRef({ theme, reducedMotion });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const origin = createSceneOrigin(NYC_CENTER);
    const fleet = new FleetScene(origin);
    const layer = createFleetLayer(fleet, origin, frameClock);
    const start = initial.current.reducedMotion ? OVERVIEW : { ...OVERVIEW, ...ESTABLISHING };
    const map = new MapLibreMap({
      container,
      style: buildMapStyle(initial.current.theme),
      ...start,
      maxPitch: 80,
      canvasContextAttributes: { antialias: true },
      attributionControl: { compact: true },
    });
    map.on("style.load", () => {
      if (!map.getLayer(FLEET_LAYER_ID)) map.addLayer(layer);
      syncOverlays(map, overlayData.current, OVERLAYS_BEFORE);
    });
    map.once("load", () => {
      if (!initial.current.reducedMotion) map.easeTo({ ...OVERVIEW, duration: INTRO_MS, easing: easeInOutCubic });
      setRuntime({ map, fleet, layer });
    });
    return () => {
      setRuntime(null);
      map.remove();
      fleet.dispose();
    };
  }, [containerRef]);

  useEffect(() => {
    if (!runtime || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    runtime.map.setStyle(buildMapStyle(theme), { diff: false });
  }, [runtime, theme]);

  useEffect(() => {
    runtime?.fleet.sync(operators, frameClock());
  }, [runtime, operators]);

  useEffect(() => {
    overlayData.current = toOverlayData(operators, selectedId);
    if (runtime?.map.isStyleLoaded()) syncOverlays(runtime.map, overlayData.current, OVERLAYS_BEFORE);
  }, [runtime, operators, selectedId]);

  return runtime;
}
