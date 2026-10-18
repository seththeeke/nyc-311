import { DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from "three";
import { LIGHT } from "./residentPalette";
import type { ResidentRig } from "./residentFigure";

/* A soft studio: sky/ground fill plus one warm key light from the front left. Background stays transparent. */
export function studioScene(): Scene {
  const scene = new Scene();
  scene.add(new HemisphereLight(LIGHT.SKY, LIGHT.GROUND, 1.8));
  const key = new DirectionalLight(LIGHT.KEY, 2.2);
  key.position.set(3, 4, 2);
  scene.add(key);
  return scene;
}

/** Head and shoulders, slightly off-centre so the face reads as three-dimensional. */
export function portraitCamera(rig: ResidentRig): PerspectiveCamera {
  rig.root.updateMatrixWorld(true);
  const head = rig.head.getWorldPosition(new Vector3());
  const camera = new PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(head.x + 1.3, head.y - 0.04, head.z + 0.28);
  camera.lookAt(head.x, head.y - 0.1, head.z);
  return camera;
}

/** The whole figure, feet to hat, with a little headroom for a waving arm. */
export function fullBodyCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(30, aspect, 0.1, 30);
  camera.position.set(3.6, 0.9, 0.5);
  camera.lookAt(0, 0.78, 0);
  return camera;
}
