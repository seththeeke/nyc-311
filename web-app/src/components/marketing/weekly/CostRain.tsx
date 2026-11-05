import type { ReactElement } from "react";

const DROPS = 28;

/*
 * Cost as a downpour: dollar signs of varied size and speed fall through the
 * card into a glowing floor. Positions are fixed per drop (no randomness) so
 * the scene is the same every time.
 */
export function CostRain({ active }: { active: boolean }): ReactElement {
  return (
    <div aria-hidden="true" className="relative h-full min-h-[18rem] w-full overflow-hidden rounded-3xl">
      {active &&
        Array.from({ length: DROPS }, (_, i) => (
          <span
            key={i}
            data-testid="dollar"
            className="absolute top-0 animate-[mk-fall_linear_infinite] font-black text-hue-emerald"
            style={{
              left: `${(i * 37) % 96}%`,
              fontSize: `${1 + ((i * 7) % 5) * 0.45}rem`,
              opacity: 0.35 + ((i * 3) % 7) / 10,
              animationDuration: `${2.4 + ((i * 5) % 7) * 0.35}s`,
              animationDelay: `${-((i * 11) % 23) / 5}s`,
            }}
          >
            $
          </span>
        ))}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-hue-emerald/30 to-transparent" />
    </div>
  );
}
