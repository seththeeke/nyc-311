import type { ReactElement } from "react";

interface ResolveClockProps {
  hours: number | null;
  active: boolean;
}

/* Where the hand stops on a 24-hour dial, after two full spins for drama. */
export function handAngle(hours: number | null): number {
  if (hours === null) return 0;
  return 720 + ((hours % 24) / 24) * 360;
}

/*
 * Mean time to resolve as a stopwatch: a 24-hour dial whose hand whips round
 * twice and settles on the value, while the elapsed arc fills behind it.
 */
export function ResolveClock({ hours, active }: ResolveClockProps): ReactElement {
  const angle = active ? handAngle(hours) : 0;
  const arc = active && hours !== null ? (hours % 24) / 24 || 1 : 0;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[20rem]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--t-line-strong)" strokeWidth="1" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="var(--t-hue-violet)"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          data-testid="clock-arc"
          className="transition-[stroke-dashoffset] delay-500 duration-[2200ms] ease-out"
          style={{ strokeDashoffset: 1 - arc }}
        />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1="4"
            x2="50"
            y2={i % 6 === 0 ? "11" : "8"}
            stroke="var(--t-fg-subtle)"
            strokeWidth={i % 6 === 0 ? 1.5 : 0.7}
            transform={`rotate(${i * 15} 50 50)`}
          />
        ))}
      </svg>
      <div
        data-testid="clock-hand"
        className="absolute inset-0 transition-transform duration-[2600ms] ease-[cubic-bezier(0.15,0.85,0.25,1)]"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <span className="absolute bottom-1/2 left-1/2 h-[38%] w-1.5 -translate-x-1/2 rounded-full bg-hue-rose shadow-[0_0_20px_var(--t-hue-rose)]" />
      </div>
      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg" />
      <span className="absolute -top-3 left-1/2 h-4 w-8 -translate-x-1/2 rounded-t-md bg-line-strong" />
    </div>
  );
}
