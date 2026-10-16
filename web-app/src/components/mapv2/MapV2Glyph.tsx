import type { ReactElement } from "react";

/* Mapv2's control glyphs, one path set per name. Decorative only: the wrapping control carries the accessible name. */
export type GlyphName = "PLUS" | "MINUS" | "ROTATE_LEFT" | "ROTATE_RIGHT" | "TILT" | "RESET" | "CLOSE" | "DIVE" | "BACK";

const PATHS: Record<GlyphName, string[]> = {
  PLUS: ["M12 5v14M5 12h14"],
  MINUS: ["M5 12h14"],
  ROTATE_LEFT: ["M4 12a8 8 0 1 0 2.4-5.7", "M4 4v4h4"],
  ROTATE_RIGHT: ["M20 12a8 8 0 1 1-2.4-5.7", "M20 4v4h-4"],
  TILT: ["M3 17 12 21l9-4-9-4-9 4Z", "M12 3v10"],
  RESET: ["M3 11 12 4l9 7", "M5 10v10h14V10"],
  CLOSE: ["M6 6l12 12M18 6 6 18"],
  DIVE: ["M12 3v12", "m6 9 6 6 6-6", "M4 21h16"],
  BACK: ["M15 5 8 12l7 7"],
};

export function MapV2Glyph({ name, className = "h-4 w-4" }: { name: GlyphName; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
