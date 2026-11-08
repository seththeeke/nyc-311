import { useEffect, useRef } from "react";
import { FPS, ROOM_H, ROOM_W, canvasPainter, type RoomDraw, type RoomState } from "./pixelKit.ts";

interface PixelRoomProps {
  draw: RoomDraw;
  state: RoomState;
  label: string;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * One room on a ROOM_W × ROOM_H canvas, scaled up by CSS with crisp pixels.
 * It animates at FPS frames a second, or holds one frame under reduced
 * motion, and stops when unmounted.
 */
export function PixelRoom({ draw, state, label }: PixelRoomProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const painter = canvasPainter(ctx);
    let t = 0;
    const frame = () => {
      ctx.clearRect(0, 0, ROOM_W, ROOM_H);
      draw(painter, { t, state, hour: new Date().getHours() });
      t += 1;
    };
    frame();
    if (prefersReducedMotion()) return;
    const timer = setInterval(frame, 1000 / FPS);
    return () => clearInterval(timer);
  }, [draw, state]);
  return (
    <canvas
      ref={ref}
      width={ROOM_W}
      height={ROOM_H}
      role="img"
      aria-label={label}
      className="block aspect-[10/7] w-full [image-rendering:pixelated]"
    />
  );
}
