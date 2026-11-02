import { useEffect, type RefObject } from "react";
import { createCity, stepCity, type CityState } from "./cityPulse";
import { readPalette, renderCity } from "./cityPulseRender";
import type { ThemeName } from "../../models/theme";

const TRUCK_COUNT = 9;
/* A still frame, for reduced motion, shows the city a few seconds in rather than empty. */
const STILL_WARMUP_SECONDS = 6;
const STILL_WARMUP_STEP = 1 / 30;
/* Caps one frame's step, so a backgrounded tab doesn't teleport every truck on return. */
const MAX_FRAME_SECONDS = 0.05;

/**
 * Runs the hero's living city on `canvasRef`: sizes it to its box at device
 * pixel ratio, animates every frame, and lights the grid under the pointer.
 * With `reducedMotion` it draws one still frame instead. Restarts on theme change.
 */
export function useCityPulse(canvasRef: RefObject<HTMLCanvasElement | null>, reducedMotion: boolean, theme: ThemeName): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) return undefined;
    const palette = readPalette(document.documentElement);
    const rng = Math.random;
    let size = { width: 0, height: 0 };
    let state: CityState = createCity(1, 1, 0, rng);
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let last: number | null = null;

    const draw = (): void => renderCity(ctx, state, palette, size, pointer);
    const resize = (): void => {
      const box = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size = { width: Math.max(1, box.width), height: Math.max(1, box.height) };
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = createCity(size.width, size.height, TRUCK_COUNT, rng);
      if (reducedMotion) {
        for (let t = 0; t < STILL_WARMUP_SECONDS; t += STILL_WARMUP_STEP) stepCity(state, STILL_WARMUP_STEP, rng);
        draw();
      }
    };
    const tick = (now: number): void => {
      const dt = last === null ? 0 : Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;
      stepCity(state, dt, rng);
      draw();
      frame = requestAnimationFrame(tick);
    };
    const onPointer = (event: PointerEvent): void => {
      const box = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const onLeave = (): void => {
      pointer = null;
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reducedMotion) {
      window.addEventListener("pointermove", onPointer);
      document.addEventListener("pointerleave", onLeave);
      frame = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [canvasRef, reducedMotion, theme]);
}
