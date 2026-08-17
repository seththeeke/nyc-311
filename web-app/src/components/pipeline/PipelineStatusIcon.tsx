import type { CSSProperties, ReactElement } from "react";
import type { StatusCategory } from "./pipelineStatusVisuals";

export interface PipelineStatusIconProps {
  category: StatusCategory;
  className?: string;
  /** Typically `{ color: visual.color }` — the icon paints in `currentColor`. */
  style?: CSSProperties;
}

// Status is never color-alone (dataviz skill) — this glyph is the icon
// half of the icon+label pairing every status mark carries here.
export function PipelineStatusIcon({ category, className, style }: PipelineStatusIconProps): ReactElement {
  if (category === "success") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className} style={style}>
        <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (category === "failure") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className} style={style}>
        <path d="M8 4v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="12" r="1.15" fill="currentColor" />
      </svg>
    );
  }
  if (category === "inProgress") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`${className ?? ""} animate-spin`} style={style}>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
        <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className} style={style}>
      <path d="M4.5 8h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
