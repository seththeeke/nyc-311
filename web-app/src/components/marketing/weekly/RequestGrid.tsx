import type { ReactElement } from "react";

/* The grid's size: each dot stands for an equal slice of the week's accepted requests. */
export const GRID_DOTS = 120;

interface RequestGridProps {
  /* Share of accepted requests serviced, 0 to 1. */
  servicedShare: number;
  active: boolean;
}

/*
 * Requests as a field of dots: every one lands amber (accepted), then a green
 * wave sweeps through as many as were serviced, each popping as it flips.
 */
export function RequestGrid({ servicedShare, active }: RequestGridProps): ReactElement {
  const lit = Math.round(servicedShare * GRID_DOTS);
  return (
    <ul aria-hidden="true" className="grid w-full grid-cols-12 gap-1.5 sm:gap-2">
      {active &&
        Array.from({ length: GRID_DOTS }, (_, i) => {
          const serviced = i < lit;
          return (
            <li
              key={i}
              data-serviced={serviced}
              className="aspect-square animate-[mk-pop_0.4s_cubic-bezier(0.3,1.6,0.5,1)_both] rounded-full"
              style={{ animationDelay: `${i * 8}ms` }}
            >
              <span
                className={`block h-full w-full rounded-full bg-hue-amber ${serviced ? "animate-[mk-service_0.5s_ease-out_forwards]" : "opacity-60"}`}
                style={serviced ? { animationDelay: `${1100 + i * 14}ms` } : undefined}
              />
            </li>
          );
        })}
    </ul>
  );
}
