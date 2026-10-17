import { type RefObject, useEffect, useState } from "react";
import { ACESFilmicToneMapping, WebGLRenderer } from "three";
import type { ThemeName } from "../../models/theme";
import { type JobScript, representativeSeconds, timelineAt, type TimelineState } from "./repairTimeline";
import { DiveScene } from "./three/diveScene";

/** Progress steps per phase that re-render the HUD — enough for a smooth bar, far fewer than 60 a second. */
const HUD_STEPS = 20;
/** Past the camera's fall, so a reduced-motion viewer starts at the resting orbit. */
const SETTLED_CAMERA_SECONDS = 1_000;

/**
 * Runs the dive-in on `canvasRef`: a WebGL renderer and DiveScene sized
 * to the canvas, animated every frame — or drawn once, frozen
 * mid-repair, under reduced motion. Returns where the job loop is.
 */
export function useDiveRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  script: JobScript,
  theme: ThemeName,
  reducedMotion: boolean
): TimelineState {
  const [timeline, setTimeline] = useState<TimelineState>(() => timelineAt(script, 0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    const dive = new DiveScene(script, theme);
    const startedAt = performance.now();
    let frame = 0;
    let hudKey = "";

    const draw = (): void => {
      const seconds = (performance.now() - startedAt) / 1000;
      const state = reducedMotion
        ? dive.update(representativeSeconds(script), SETTLED_CAMERA_SECONDS, false)
        : dive.update(seconds, seconds, true);
      renderer.render(dive.scene, dive.camera);
      const key = `${state.index}:${Math.floor(state.progress * HUD_STEPS)}`;
      if (key !== hudKey) {
        hudKey = key;
        setTimeline(state);
      }
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };
    const resize = (): void => {
      const { clientWidth, clientHeight } = canvas;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      dive.setAspect(clientWidth / clientHeight);
      if (reducedMotion) draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      dive.dispose();
      renderer.dispose();
    };
  }, [canvasRef, script, theme, reducedMotion]);

  return timeline;
}
