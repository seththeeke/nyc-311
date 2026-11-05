import type { ReactElement } from "react";
import { PatchMascot } from "./PatchMascot";
import { useTicker } from "../useTicker";

/* Patch's lines, one per pothole pass. */
export const PATCH_LINES: readonly string[] = ["Pothole on Atlantic? On it.", "Another one patched!", "Next stop: the Bronx.", "Ready when you are."];
/* One pothole's trip across the road; the truck bounces and the hole is patched mid-trip. */
export const PASS_MS = 5000;

/* A row of buildings: [x, width, height] in a 400-wide strip, repeated twice for a seamless drift. */
const BUILDINGS: readonly (readonly [number, number, number])[] = [
  [0, 34, 70], [38, 22, 110], [64, 40, 85], [108, 26, 140], [138, 44, 95], [186, 30, 120], [220, 48, 75], [272, 24, 150], [300, 38, 100], [342, 28, 125], [374, 26, 80],
];

/*
 * The closing scene: a night skyline with twinkling windows drifting by, a
 * road whose lane lines rush past, and Patch driving it. Each pothole rolls in,
 * Patch bounces over it, and it comes out patched with a sparkle.
 */
export function CityStrip({ playing }: { playing: boolean }): ReactElement {
  const line = PATCH_LINES[useTicker(PASS_MS, playing) % PATCH_LINES.length];
  return (
    <div className="relative h-80 w-full overflow-hidden sm:h-96">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-24 h-40 animate-[mk-drift_60s_linear_infinite] opacity-70" style={{ width: "200%" }}>
        <svg viewBox="0 0 800 160" preserveAspectRatio="none" className="h-full w-full">
          {[0, 400].flatMap((shift) =>
            BUILDINGS.map(([x, w, h], i) => (
              <g key={`${shift}-${x}`}>
                <rect x={x + shift} y={160 - h} width={w} height={h} fill="var(--t-panel-strong)" />
                {Array.from({ length: Math.floor(h / 22) }, (_, row) => (
                  <rect
                    key={row}
                    x={x + shift + w / 2 - 4}
                    y={160 - h + 10 + row * 22}
                    width="8"
                    height="8"
                    fill="var(--t-hue-amber)"
                    className="animate-[mk-twinkle_3s_ease-in-out_infinite]"
                    style={{ animationDelay: `${-((i * 7 + row * 3) % 11) / 3}s` }}
                  />
                ))}
              </g>
            )),
          )}
        </svg>
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-panel-sunken">
        <div className="mk-lanes absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2" />
        <span className="absolute top-[30%] h-4 w-16 animate-[mk-pothole_5s_linear_infinite] rounded-[50%]" />
        <span className="absolute left-[42%] top-[10%] h-16 w-16 -translate-x-1/2 animate-[mk-sparkle_5s_linear_infinite] rounded-full" />
      </div>
      <div className="absolute bottom-8 left-[42%] h-36 w-64 -translate-x-1/2 animate-[mk-truck_5s_ease-in-out_infinite] sm:h-44 sm:w-80">
        <PatchMascot />
        <p key={line} className="glass absolute -top-14 left-1/2 -translate-x-1/2 animate-[mk-rise_0.5s_ease-out_both] whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-bold text-fg">
          {line}
        </p>
      </div>
    </div>
  );
}
