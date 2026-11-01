import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  NoToneMapping,
  type Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  type Texture,
  Vector3,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LIGHT } from "../../residents/models/residentPalette";
import type { ResidentRig } from "../../residents/models/residentFigure";
import type { TeamRig } from "./kit/teamBody";
import { poseTeam } from "./kit/teamMotion";

/* Poses sampled across a performance to frame it. */
const FRAMING_SAMPLES = 48;

/*
 * The executives' studio (#146): an environment map for reflections, a
 * three-point rig (warm key, cool fill, rim light behind) and filmic tone
 * mapping, plus cameras that frame whatever the figure's shape is.
 */

const environments = new WeakMap<WebGLRenderer, Texture>();

function environmentFor(renderer: WebGLRenderer): Texture {
  const cached = environments.get(renderer);
  if (cached) return cached;
  const generator = new PMREMGenerator(renderer);
  const texture = generator.fromScene(new RoomEnvironment(), 0.04).texture;
  generator.dispose();
  environments.set(renderer, texture);
  return texture;
}

export function teamStudio(renderer: WebGLRenderer): Scene {
  const scene = new Scene();
  scene.environment = environmentFor(renderer);
  scene.environmentIntensity = 0.55;
  scene.add(new HemisphereLight(LIGHT.SKY, LIGHT.GROUND, 0.7));
  const lights: [string, number, [number, number, number]][] = [
    [LIGHT.KEY, 2.6, [3, 4, 2.2]],
    [LIGHT.FILL, 0.9, [2.5, 1.2, -3]],
    [LIGHT.RIM, 2.4, [-3, 2.5, 1]],
  ];
  for (const [color, intensity, position] of lights) {
    const light = new DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }
  return scene;
}

/** Filmic tone mapping on for a team render; returns a function that puts the renderer back. */
export function applyFilmicTone(renderer: WebGLRenderer): () => void {
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return () => {
    renderer.toneMapping = NoToneMapping;
  };
}

/** Frames the head and whatever is on it (a hat, a beard, a bow), a little off-centre. */
export function teamPortraitCamera(rig: ResidentRig): PerspectiveCamera {
  rig.root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(rig.head);
  const centre = box.getCenter(new Vector3());
  const span = Math.max(box.max.y - box.min.y, box.max.z - box.min.z, 0.5) * 1.2;
  const camera = new PerspectiveCamera(26, 1, 0.05, 30);
  const distance = span / 2 / Math.tan((13 * Math.PI) / 180);
  camera.position.set(centre.x + distance, centre.y + 0.02, centre.z + distance * 0.22);
  camera.lookAt(centre.x, centre.y - 0.03, centre.z);
  return camera;
}

/* Grows `box` by every mesh under `node`, skipping effects (sparks fly wide; the figure is what to frame). */
function frame(node: Object3D, box: Box3): void {
  if (node.userData.fx) return;
  if (node instanceof Mesh) box.expandByObject(node, false);
  else for (const child of node.children) frame(child, box);
}

/** The whole figure and its props through its whole performance, sampled, so a raised hammer or a jump stays in shot. */
export function teamFullBodyCamera(rig: TeamRig, aspect: number): PerspectiveCamera {
  const box = new Box3();
  const cycle = rig.cycle ?? 0;
  for (let i = 0; i <= (cycle ? FRAMING_SAMPLES : 0); i++) {
    poseTeam(rig, (cycle * i) / FRAMING_SAMPLES);
    rig.root.updateMatrixWorld(true);
    frame(rig.root, box);
  }
  poseTeam(rig, 0);
  const height = Math.max(box.max.y, 1.2) * 1.06;
  /* Across the camera's view; depth (x, toward the camera) only matters as the figure turns. */
  const width = Math.max(box.max.z - box.min.z, (box.max.x - box.min.x) * 0.6) * 1.1;
  const fov = 30;
  const half = Math.tan(((fov / 2) * Math.PI) / 180);
  const distance = Math.max(height / 2 / half, width / 2 / (half * aspect)) + 0.4;
  const camera = new PerspectiveCamera(fov, aspect, 0.05, 40);
  camera.position.set(distance, height * 0.5, distance * 0.14);
  camera.lookAt(0, height * 0.47, 0);
  return camera;
}
