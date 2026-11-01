import { type RefObject, useEffect } from "react";
import { WebGLRenderer } from "three";
import { disposeObject } from "../three/threeKit";
import { stageTurn } from "../residents/useResidentStage";
import { poseTeam } from "./models/kit/teamMotion";
import { TEAM_MODELS } from "./models/teamModels";
import { applyFilmicTone, teamFullBodyCamera, teamStudio } from "./models/teamStudio";

/* Radians of turn per pixel dragged. */
export const DRAG_TURN = 0.012;

/**
 * Runs an executive's full figure (#146) on `canvasRef` in the team
 * studio: performing its signature move on a loop, drifting, and turning
 * when dragged. With reduced motion it holds the performance's key moment.
 */
export function useTeamStage(canvasRef: RefObject<HTMLCanvasElement | null>, modelKey: string, reducedMotion: boolean): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const build = TEAM_MODELS[modelKey];
    if (!canvas || !build) return undefined;
    const rig = build();
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    applyFilmicTone(renderer);
    const scene = teamStudio(renderer);
    scene.add(rig.root);
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 420;
    renderer.setSize(width, height, false);
    const camera = teamFullBodyCamera(rig, width / height);

    const still = rig.still ?? 0;
    let spin = 0;
    let dragFrom: number | null = null;
    const onDown = (event: PointerEvent): void => {
      dragFrom = event.clientX;
    };
    const onMove = (event: PointerEvent): void => {
      if (dragFrom === null) return;
      spin += (event.clientX - dragFrom) * DRAG_TURN;
      dragFrom = event.clientX;
      if (reducedMotion) draw(still);
    };
    const onUp = (): void => {
      dragFrom = null;
    };
    const draw = (t: number): void => {
      poseTeam(rig, t);
      rig.root.rotation.y = stageTurn(t) + spin;
      renderer.render(scene, camera);
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    let frame = 0;
    if (reducedMotion) {
      draw(still);
    } else {
      const start = performance.now();
      const loop = (): void => {
        draw((performance.now() - start) / 1000);
        frame = requestAnimationFrame(loop);
      };
      loop();
    }
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      disposeObject(rig.root);
      renderer.dispose();
    };
  }, [canvasRef, modelKey, reducedMotion]);
}
