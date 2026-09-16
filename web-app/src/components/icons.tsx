import type { ReactElement } from "react";

export interface IconProps {
  className?: string;
}

const DEFAULT_CLASS = "h-4 w-4";

/**
 * Small hand-rolled action icons (admin warehouse condensed-row
 * enhancement) — no icon library is used anywhere else in `web-app/`, so
 * three inline SVGs keep this dependency-free rather than pulling one in
 * for three glyphs.
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
