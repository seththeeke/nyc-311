import { type ReactElement, useRef } from "react";
import { useResidentStage } from "./useResidentStage";

interface ResidentStageProps {
  name: string;
  modelKey: string;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The resident in full, standing and waving beside their profile (the
 * Mii-style view, 13-customer-simulation.md Appendix P). Lazy-loaded, so
 * Three.js stays out of the main bundle.
 */
export default function ResidentStage({ name, modelKey }: ResidentStageProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useResidentStage(canvasRef, modelKey, prefersReducedMotion());
  return <canvas ref={canvasRef} role="img" aria-label={`${name}, waving`} className="h-64 w-48 shrink-0" />;
}
