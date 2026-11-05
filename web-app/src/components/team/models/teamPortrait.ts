import type { WebGLRenderer } from "three";
import { disposeObject } from "../../three/threeKit";
import { poseTeam } from "./kit/teamMotion";
import { TEAM_MODELS } from "./teamModels";
import { applyFilmicTone, teamPortraitCamera, teamStudio } from "./teamStudio";

/** Draws an executive's portrait (#146) into `renderer`, in the team studio; works on a DOM or an offscreen canvas. */
export function renderTeamMember(renderer: WebGLRenderer, modelKey: string): void {
  const rig = TEAM_MODELS[modelKey]();
  poseTeam(rig, 0);
  const scene = teamStudio(renderer);
  scene.add(rig.root);
  const restore = applyFilmicTone(renderer);
  renderer.render(scene, teamPortraitCamera(rig));
  restore();
  disposeObject(rig.root);
}

/** An executive's avatar (#146) through the shared avatar renderer, as a PNG data URL. */
export function photographTeamMember(renderer: WebGLRenderer, modelKey: string): string {
  renderTeamMember(renderer, modelKey);
  return renderer.domElement.toDataURL("image/png");
}
