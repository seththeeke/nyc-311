import { type RefObject, useEffect } from "react";
import { WebGLRenderer } from "three";
import { disposeObject } from "../three/threeKit";
import { poseResident, type Pose } from "./models/residentFigure";
import { buildResidentModel } from "./models/residentModels";
import { fullBodyCamera, studioScene } from "./models/residentScene";

/* Waves for this long, then stands for STAND_SECONDS, and repeats. */
export const WAVE_SECONDS = 2.4;
export const STAND_SECONDS = 2.2;

/** Which pose the stage shows `t` seconds in. */
export function stagePose(t: number): Pose {
  return t % (WAVE_SECONDS + STAND_SECONDS) < WAVE_SECONDS ? "WAVE" : "IDLE";
}

/* A three-quarter view that drifts a little, so the figure reads as 3-D. */
export function stageTurn(t: number): number {
  return 0.25 + Math.sin(t * 0.5) * 0.2;
}

/**
 * Runs the resident's full-body model on `canvasRef`: standing and
 * waving, in a soft studio. One renderer per mounted stage, disposed on
 * unmount. With reduced motion it draws one still frame mid-wave.
 */
export function useResidentStage(canvasRef: RefObject<HTMLCanvasElement | null>, modelKey: string | null, reducedMotion: boolean): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const rig = buildResidentModel(modelKey);
    if (!canvas || !rig) return undefined;
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = studioScene();
    scene.add(rig.root);
    const width = canvas.clientWidth || 240;
    const height = canvas.clientHeight || 320;
    renderer.setSize(width, height, false);
    const camera = fullBodyCamera(width / height);

    const draw = (t: number): void => {
      poseResident(rig, stagePose(t), t);
      rig.root.rotation.y = stageTurn(t);
      renderer.render(scene, camera);
    };
    let frame = 0;
    if (reducedMotion) {
      draw(WAVE_SECONDS / 2);
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
      disposeObject(rig.root);
      renderer.dispose();
    };
  }, [canvasRef, modelKey, reducedMotion]);
}
