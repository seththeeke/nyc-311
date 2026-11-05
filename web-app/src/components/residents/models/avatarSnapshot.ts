import { WebGLRenderer } from "three";
import { disposeObject } from "../../three/threeKit";
import { poseResident } from "./residentFigure";
import { buildResidentModel } from "./residentModels";
import { portraitCamera, studioScene } from "./residentScene";
import { isTeamModel } from "../../team/models/teamModels";
import { renderTeamMember } from "../../team/models/teamPortrait";

/*
 * The small avatar (13-customer-simulation.md §2 customer side, decision
 * 3): one shared renderer photographs a resident's head and shoulders
 * once. Callers cache it and show it as an <img>, so a page of avatars
 * costs one WebGL context, not one each. The drawing runs on a DOM canvas
 * here, or on an offscreen one in the avatar worker (avatarWorkerCore.ts).
 */

/* Pixels square; drawn at 48px or less, so this covers 2x and 3x screens. */
export const AVATAR_PIXELS = 160;

/** A transparent, square avatar renderer on `canvas` (a page canvas or an OffscreenCanvas). */
export function createAvatarRenderer(canvas: HTMLCanvasElement | OffscreenCanvas): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(AVATAR_PIXELS, AVATAR_PIXELS, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/** Draws `modelKey`'s portrait into `renderer`; false when the key names no model. */
export function drawAvatar(renderer: WebGLRenderer, modelKey: string): boolean {
  if (isTeamModel(modelKey)) {
    renderTeamMember(renderer, modelKey);
    return true;
  }
  const rig = buildResidentModel(modelKey);
  if (!rig) return false;
  poseResident(rig, "IDLE", 0);
  const scene = studioScene();
  scene.add(rig.root);
  renderer.render(scene, portraitCamera(rig));
  disposeObject(rig.root);
  return true;
}

let renderer: WebGLRenderer | null = null;

/** A PNG data URL of the resident, drawn on the main thread, or null when `modelKey` names no model. */
export function renderResidentAvatar(modelKey: string): string | null {
  renderer ??= createAvatarRenderer(document.createElement("canvas"));
  return drawAvatar(renderer, modelKey) ? renderer.domElement.toDataURL("image/png") : null;
}
