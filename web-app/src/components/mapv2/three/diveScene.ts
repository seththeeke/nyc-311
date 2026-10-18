import { PerspectiveCamera, Scene } from "three";
import type { ThemeName } from "../../../models/theme";
import type { JobScript, TimelineState } from "../repairTimeline";
import { buildDiveEnvironment } from "./diveEnvironment";
import { buildDiveCast, type DiveCast, SITE } from "./diveCast";
import { choreograph } from "./diveChoreography";
import { disposeObject } from "../../three/threeKit";

/*
 * The dive-in: the stylised block, its cast, and a camera that drops out
 * of the sky onto the work site then sways slowly across it. Rendering is
 * the caller's job (DiveView), so this stays testable without WebGL.
 */

const INTRO_SECONDS = 2.6;
const SWAY_RATE = 0.12;
const SWAY_RADIANS = 0.6;
/** Mostly from the storefront side (+z), looking across the site at the brownstones. */
const BASE_ANGLE = 0.3;
const RESTING = { height: 12, radius: 20 };
const FALL = { height: 64, radius: 1.5 };

export interface CameraRig {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Where the camera sits `seconds` after the dive starts: dropping from
 * straight above the site to a low three-quarter view, then swaying
 * across the front of the block when `orbit` is on. It never circles
 * behind the storefronts, which would put buildings between it and the job.
 */
export function cameraAt(seconds: number, orbit: boolean): CameraRig {
  const intro = Math.min(1, Math.max(0, seconds / INTRO_SECONDS));
  const ease = 1 - (1 - intro) ** 3;
  const height = FALL.height + (RESTING.height - FALL.height) * ease;
  const radius = FALL.radius + (RESTING.radius - FALL.radius) * ease;
  const angle = BASE_ANGLE + (orbit ? Math.sin(seconds * SWAY_RATE) * SWAY_RADIANS : 0);
  return {
    position: [SITE.x + Math.sin(angle) * radius, height, SITE.z + Math.cos(angle) * radius],
    target: [SITE.x, 1.1, SITE.z],
  };
}

export class DiveScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 16 / 9, 0.5, 400);
  private readonly cast: DiveCast;
  private readonly script: JobScript;

  constructor(script: JobScript, theme: ThemeName) {
    this.script = script;
    buildDiveEnvironment(this.scene, theme);
    this.cast = buildDiveCast(this.scene);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param loopSeconds Time into the repair loop.
   * @param cameraSeconds Time since the dive began; a reduced-motion caller passes a large value to skip the fall.
   * @param orbit Whether the camera circles the site.
   */
  update(loopSeconds: number, cameraSeconds: number, orbit: boolean): TimelineState {
    const rig = cameraAt(cameraSeconds, orbit);
    this.camera.position.set(...rig.position);
    this.camera.lookAt(...rig.target);
    return choreograph(this.cast, this.script, loopSeconds);
  }

  dispose(): void {
    disposeObject(this.scene);
  }
}
