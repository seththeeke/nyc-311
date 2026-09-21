import type { ReactElement } from "react";

export interface IconProps {
  className?: string;
}

const DEFAULT_CLASS = "h-4 w-4";

/**
 * Small hand-rolled action icons (admin warehouse condensed-row
 * enhancement) — no icon library is used anywhere else in `web-app/`, so
 * inline SVGs keep this dependency-free rather than pulling one in for a
 * handful of glyphs.
 */
export function LoadIcon({ className = DEFAULT_CLASS }: IconProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M6 4.5v11l9-5.5-9-5.5Z" />
    </svg>
  );
}

export function HistoryIcon({ className = DEFAULT_CLASS }: IconProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v4l3 2" />
    </svg>
  );
}

export function DeleteIcon({ className = DEFAULT_CLASS }: IconProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 6h10M8 6V4.5h4V6m-6 0 .6 9a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L14 6" />
    </svg>
  );
}

/** A generic loading spinner — bakes in `animate-spin` since it's never shown static. */
export function SpinnerIcon({ className = DEFAULT_CLASS }: IconProps): ReactElement {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`${className} animate-spin`}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ConstructionIcon({ className = DEFAULT_CLASS }: IconProps): ReactElement {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden="true">
      <path strokeLinejoin="round" d="M8.2 3h3.6l3.4 12H4.8L8.2 3Z" />
      <path strokeLinecap="round" d="M6.6 9h6.8M3 17h14" />
    </svg>
  );
}
