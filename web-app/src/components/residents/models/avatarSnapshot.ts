import { WebGLRenderer } from "three";
import { disposeObject } from "../../three/threeKit";
import { poseResident } from "./residentFigure";
import { buildResidentModel } from "./residentModels";
import { portraitCamera, studioScene } from "./residentScene";

/*
 * The small avatar (13-customer-simulation.md §2 customer side, decision
 * 3): one shared offscreen renderer photographs a resident's head and
 * shoulders once, as a PNG data URL. Callers cache it and show it as an
 * <img>, so a page of avatars costs one WebGL context, not one each.
 */

/* Pixels square; drawn at 48px or less, so this covers 2x and 3x screens. */
export const AVATAR_PIXELS = 160;

let renderer: WebGLRenderer | null = null;

function sharedRenderer(): WebGLRenderer {
  if (!renderer) {
    renderer = new WebGLRenderer({ canvas: document.createElement("canvas"), antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(AVATAR_PIXELS, AVATAR_PIXELS, false);
    renderer.setClearColor(0x000000, 0);
  }
  return renderer;
}

/** A PNG data URL of the resident, or null when `modelKey` names no model. */
export function renderResidentAvatar(modelKey: string): string | null {
  const rig = buildResidentModel(modelKey);
  if (!rig) return null;
  poseResident(rig, "IDLE", 0);
  const scene = studioScene();
  scene.add(rig.root);
  const target = sharedRenderer();
  target.render(scene, portraitCamera(rig));
  const url = target.domElement.toDataURL("image/png");
  disposeObject(rig.root);
  return url;
}
