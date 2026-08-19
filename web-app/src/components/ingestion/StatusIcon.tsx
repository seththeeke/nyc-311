import type { ReactElement } from "react";

export interface StatusIconProps {
  success: boolean;
  className?: string;
}

/*
 * Status is never color-alone (dataviz skill) — this glyph is the icon half
 * of the icon+label pairing every status mark carries; the color half lives
 * wherever this is rendered (background fill, text color).
 */
export function StatusIcon({ success, className }: StatusIconProps): ReactElement {
  return success ? (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path d="M8 4v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="12" r="1.15" fill="currentColor" />
    </svg>
  );
}
