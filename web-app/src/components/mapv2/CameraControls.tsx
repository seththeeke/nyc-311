import type { ReactElement } from "react";
import { GLASS } from "./hudStyle";
import { type GlyphName, MapV2Glyph } from "./MapV2Glyph";
import type { CameraActions } from "./useCityCamera";

/* The city camera's on-screen controls — every map gesture also has a keyboard-reachable button. No `title`: the shell's TooltipLayer shows each aria-label on hover. */
export function CameraControls({ actions }: { actions: CameraActions }): ReactElement {
  const buttons: [GlyphName, string, () => void][] = [
    ["PLUS", "Zoom in", actions.zoomIn],
    ["MINUS", "Zoom out", actions.zoomOut],
    ["ROTATE_LEFT", "Rotate left", () => actions.rotate(-45)],
    ["ROTATE_RIGHT", "Rotate right", () => actions.rotate(45)],
    ["TILT", "Toggle 3-D tilt", actions.toggleTilt],
    ["RESET", "Reset to city overview", actions.resetView],
  ];
  return (
    <div role="toolbar" aria-label="Camera" className={`${GLASS} absolute right-4 bottom-8 z-10 flex flex-col gap-1 p-1.5`}>
      {buttons.map(([glyph, label, onClick]) => (
        <button
          key={glyph}
          type="button"
          aria-label={label}
          onClick={onClick}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted transition hover:bg-panel-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:outline-none"
        >
          <MapV2Glyph name={glyph} />
        </button>
      ))}
    </div>
  );
}
