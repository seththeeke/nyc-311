import type { ReactElement } from "react";

interface CapacityTankProps {
  /* Share of operators out on a job, 0 to 1: the liquid's level. */
  level: number;
  active: boolean;
}

/* One wave's path: a sine across twice the tank's width, so sliding it by half loops seamlessly. */
const WAVE = "M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V 110 H 0 Z";

/*
 * Capacity as liquid: a round glass tank whose level is the share of the
 * fleet out on a job, with two waves rolling at different speeds and bubbles
 * rising. It fills from empty when the card arrives.
 */
export function CapacityTank({ level, active }: CapacityTankProps): ReactElement {
  const fill = active ? level : 0;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[20rem]">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <defs>
          <clipPath id="mk-tank">
            <circle cx="50" cy="50" r="46" />
          </clipPath>
          <linearGradient id="mk-liquid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--t-hue-cyan)" />
            <stop offset="100%" stopColor="var(--t-hue-blue)" />
          </linearGradient>
        </defs>
        <g clipPath="url(#mk-tank)">
          <g
            data-testid="tank-level"
            className="transition-transform duration-[2200ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ transform: `translateY(${92 - fill * 88}px)` }}
          >
            <path d={WAVE} fill="url(#mk-liquid)" opacity="0.45" className="animate-[mk-wave_5s_linear_infinite]" />
            <path d={WAVE} fill="url(#mk-liquid)" transform="translate(0 3)" className="animate-[mk-wave_3.2s_linear_infinite_reverse]" />
          </g>
          {[18, 34, 52, 66, 80].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="104"
              r={1 + (i % 3) * 0.6}
              fill="white"
              opacity="0.5"
              className="animate-[mk-bubble_4s_ease-in_infinite]"
              style={{ animationDelay: `${i * 0.7}s` }}
            />
          ))}
        </g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="var(--t-hue-cyan)" strokeWidth="1.5" opacity="0.7" />
        <path d="M24 26 A 34 34 0 0 1 44 13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
      </svg>
    </div>
  );
}
