import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from "maplibre-gl";
import { Camera, Matrix4, Vector3, WebGLRenderer } from "three";
import type { SceneOrigin } from "../geo";
import type { FleetScene } from "./fleetScene";

/*
 * Hosts the FleetScene inside MapLibre as a 3-D custom layer: Three.js
 * draws into MapLibre's own WebGL context with MapLibre's camera matrix,
 * so trucks sit in the same depth buffer as the extruded buildings and
 * hide behind towers correctly.
 */

export const FLEET_LAYER_ID = "mapv2-fleet";

export interface FleetLayer extends CustomLayerInterface {
  /** Stops the continuous repaint (e.g. while the dive-in covers the city); the map still draws on interaction. */
  setPaused(paused: boolean): void;
}

export function createFleetLayer(fleet: FleetScene, origin: SceneOrigin, clock: () => number): FleetLayer {
  const camera = new Camera();
  /* Scene metres → mercator units, with three's y-up turned to mercator's z-up (+z south stays +y south). */
  const sceneToMercator = new Matrix4()
    .makeTranslation(origin.mercator.x, origin.mercator.y, 0)
    .scale(new Vector3(origin.unitsPerMeter, -origin.unitsPerMeter, origin.unitsPerMeter))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2));
  let map: MapLibreMap | null = null;
  let renderer: WebGLRenderer | null = null;
  let paused = false;

  return {
    id: FLEET_LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(addedTo, gl) {
      map = addedTo;
      renderer = new WebGLRenderer({ canvas: addedTo.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    onRemove() {
      map = null;
      renderer = null;
    },
    render(_gl, args: CustomRenderMethodInput) {
      if (!map || !renderer) return;
      fleet.update(clock(), map.getZoom());
      camera.projectionMatrix = new Matrix4().fromArray(args.defaultProjectionData.mainMatrix).multiply(sceneToMercator);
      renderer.resetState();
      renderer.render(fleet.scene, camera);
      if (!paused) map.triggerRepaint();
    },
    setPaused(next) {
      paused = next;
      if (!next) map?.triggerRepaint();
    },
  };
}
