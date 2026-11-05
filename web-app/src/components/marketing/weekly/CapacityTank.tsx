import type { ReactElement } from "react";

interface CapacityTankProps {
  /* Share of operators out on a job, 0 to 1: how high the pile of trucks reaches. */
  level: number;
  active: boolean;
}

interface Slot {
  x: number;
  y: number;
  angle: number;
  flip: boolean;
  hue: string;
}

const R = 46;
const TRUCK_W = 14;
const ROW_STEP = 6.5;
const COL_STEP = 12.5;
const HUES = ["--t-hue-orange", "--t-hue-amber", "--t-hue-cyan", "--t-hue-emerald", "--t-hue-violet", "--t-hue-rose"];

/* A fixed pseudo-random number in [0, 1) per seed, so the pile is messy but the same on every render. */
const jitter = (seed: number): number => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/*
 * Every place a truck can land, bottom of the bowl first: rows stepping up
 * the circle, each as wide as the circle is at that height, nudged and tilted
 * so the trucks look tossed in rather than parked.
 */
const SLOTS: readonly Slot[] = (() => {
  const slots: { slot: Slot; order: number }[] = [];
  let row = 0;
  for (let y = 50 + R - 9; y > 50 - R + 4; y -= ROW_STEP, row += 1) {
    const half = Math.sqrt(R * R - (y + 4 - 50) ** 2);
    const start = 50 - half + 1 + (row % 2) * (COL_STEP / 2);
    for (let x = start; x + TRUCK_W <= 50 + half - 1; x += COL_STEP) {
      const i = slots.length;
      slots.push({
        slot: {
          x: x + (jitter(i + 1) - 0.5) * 3,
          y: y + (jitter(i + 7) - 0.5) * 2,
          angle: (jitter(i + 13) - 0.5) * 50,
          flip: jitter(i + 19) > 0.5,
          hue: HUES[Math.floor(jitter(i + 23) * HUES.length)],
        },
        order: row + jitter(i + 29) * 1.5,
      });
    }
  }
  return slots.sort((a, b) => a.order - b.order).map((s) => s.slot);
})();

/* A small boxy repair truck, 14 wide and 9 tall, drawn from its top-left corner. */
function MiniTruck({ hue }: { hue: string }): ReactElement {
  return (
    <>
      <rect x="0" y="0.5" width="9" height="6" rx="1" fill={`var(${hue})`} />
      <rect x="0" y="3.2" width="9" height="1.1" fill="white" opacity="0.35" />
      <path d="M9 2 H11.6 Q12.6 2 13.1 3 L14 5 V6.5 H9 Z" fill={`var(${hue})`} />
      <path d="M10 2.8 H11.5 L12.6 4.6 H10 Z" fill="var(--t-surface)" opacity="0.8" />
      <circle cx="3" cy="7" r="1.6" fill="#1e293b" />
      <circle cx="11" cy="7" r="1.6" fill="#1e293b" />
    </>
  );
}

/*
 * Capacity as a pile of trucks in a round glass bowl: the share of the fleet
 * out on a job sets how many trucks are in it. They drop in one after another,
 * bottom of the pile first, when the card arrives.
 */
export function CapacityTank({ level, active }: CapacityTankProps): ReactElement {
  const count = Math.round(Math.min(1, Math.max(0, level)) * SLOTS.length);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[20rem]">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <defs>
          <clipPath id="mk-tank">
            <circle cx="50" cy="50" r={R} />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r={R} fill="var(--t-hue-cyan)" opacity="0.06" />
        <g clipPath="url(#mk-tank)" data-testid="truck-pile" data-count={count}>
          {SLOTS.slice(0, count).map((slot, i) => (
            <g
              key={i}
              data-testid="pile-truck"
              className="transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.34,1.45,0.64,1)] motion-reduce:transition-none"
              style={{
                transform: active ? "translateY(0)" : "translateY(-110px)",
                opacity: active ? 1 : 0,
                transitionDelay: active ? `${i * 35}ms` : "0ms",
              }}
            >
              <g transform={`translate(${slot.x} ${slot.y}) rotate(${slot.angle} 7 4.5)${slot.flip ? " translate(14 0) scale(-1 1)" : ""}`}>
                <MiniTruck hue={slot.hue} />
              </g>
            </g>
          ))}
        </g>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--t-hue-cyan)" strokeWidth="1.5" opacity="0.7" />
        <path d="M24 26 A 34 34 0 0 1 44 13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
      </svg>
    </div>
  );
}
