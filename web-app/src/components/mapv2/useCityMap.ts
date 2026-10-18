import { type RefObject, useEffect, useRef, useState } from "react";
import { type JumpToOptions, Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
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
 * The home view: all five boroughs, tilted. Buildings only exist from
 * tile zoom 13 (OpenMapTiles), so they rise as you zoom in. This fixed
 * camera is the fallback; `overviewCamera` fits the workspace's size.
 */
export const OVERVIEW = { center: [-73.94, 40.7] as [number, number], zoom: 11.2, pitch: 50, bearing: -20 };
/** Staten Island's south-west tip to the Bronx's north-east edge. */
export const NYC_BOUNDS: [[number, number], [number, number]] = [
  [-74.26, 40.49],
  [-73.69, 40.92],
];
/* Extra room at the top keeps the boroughs below the HUD row; the right clears the camera controls. */
const OVERVIEW_PADDING = { top: 150, bottom: 30, left: 30, right: 80 };
/** cameraForBounds fits the bounds flat; tilted, the far half shrinks, so zoom back in to fill the view. */
const TILT_ZOOM_GAIN = 0.55;
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

/** The overview fitted to the map's current size, so every borough is in view however wide the workspace is. */
export function overviewCamera(map: MapLibreMap): JumpToOptions {
  const fit = map.cameraForBounds(NYC_BOUNDS, { bearing: OVERVIEW.bearing, padding: OVERVIEW_PADDING });
  if (fit?.zoom === undefined) return OVERVIEW;
  return { ...OVERVIEW, center: fit.center, zoom: fit.zoom + TILT_ZOOM_GAIN };
}

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
    /*
     * MapLibre and three both rebuild their GL state after a context loss
     * (GPU reset, sleep, eviction), but nothing redraws until the next
     * interaction: the fleet layer's repaint loop stopped while the context was gone.
     */
    map.on("webglcontextlost", () => console.warn("mapv2: city WebGL context lost"));
    map.on("webglcontextrestored", () => {
      console.warn("mapv2: city WebGL context restored");
      map.triggerRepaint();
    });
    map.once("load", () => {
      if (initial.current.reducedMotion) map.jumpTo(overviewCamera(map));
      else map.easeTo({ ...overviewCamera(map), duration: INTRO_MS, easing: easeInOutCubic });
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
