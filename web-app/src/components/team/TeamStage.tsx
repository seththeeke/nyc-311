import { type ReactElement, useRef } from "react";
import { useTeamStage } from "./useTeamStage";

interface TeamStageProps {
  name: string;
  modelKey: string;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** An executive in full (#146), larger than a resident's stage; drag to turn them. Lazy-loaded with Three.js. */
export default function TeamStage({ name, modelKey }: TeamStageProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useTeamStage(canvasRef, modelKey, prefersReducedMotion());
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${name}, performing. Drag to turn.`}
      className="h-[26rem] w-full max-w-xs cursor-grab touch-pan-y active:cursor-grabbing"
    />
  );
}
