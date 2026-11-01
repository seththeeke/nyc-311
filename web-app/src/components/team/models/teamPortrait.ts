import type { WebGLRenderer } from "three";
import { disposeObject } from "../../three/threeKit";
import { poseTeam } from "./kit/teamMotion";
import { TEAM_MODELS } from "./teamModels";
import { applyFilmicTone, teamPortraitCamera, teamStudio } from "./teamStudio";

/** An executive's avatar (#146) through the shared avatar renderer, in the team studio. */
export function photographTeamMember(renderer: WebGLRenderer, modelKey: string): string {
  const rig = TEAM_MODELS[modelKey]();
  poseTeam(rig, 0);
  const scene = teamStudio(renderer);
  scene.add(rig.root);
  const restore = applyFilmicTone(renderer);
  renderer.render(scene, teamPortraitCamera(rig));
  restore();
  const url = renderer.domElement.toDataURL("image/png");
  disposeObject(rig.root);
  return url;
}
