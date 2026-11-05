import type { ReactElement, ReactNode } from "react";
import { cardTransform } from "../JourneyCard";
import { useCountUp } from "../useCountUp";

interface WeeklyCardProps {
  label: string;
  value: number | null;
  format: (value: number) => string;
  caption: string;
  delta: string | null;
  /* Text and glow colour classes for the card's hue. */
  hueText: string;
  hueShadow: string;
  offset: number;
  reducedMotion: boolean;
  children: ReactNode;
}

const COUNT_UP_MS = 2000;

/*
 * One "This week" number as a large card: the figure counting up beside its
 * animated visual. Like the journey cards, the current one sits square and the
 * others tip away; the figure counts each time the card arrives.
 */
export function WeeklyCard({ label, value, format, caption, delta, hueText, hueShadow, offset, reducedMotion, children }: WeeklyCardProps): ReactElement {
  const current = offset === 0;
  const shown = useCountUp(value, current, COUNT_UP_MS, reducedMotion);
  const { transform, opacity } = cardTransform(offset);
  return (
    <article
      aria-hidden={!current}
      data-current={current}
      style={{ transform, opacity }}
      className={`mk-stage absolute inset-0 grid origin-top items-center gap-6 overflow-hidden rounded-[2rem] border border-line-strong p-6 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:p-10 lg:grid-cols-2 lg:gap-12 ${hueShadow} ${current ? "" : "pointer-events-none"}`}
    >
      <div className="relative">
        <p className={`text-sm font-bold uppercase tracking-[0.25em] ${hueText}`}>{label}</p>
        <p className="mt-4 text-6xl font-black tabular-nums tracking-tight text-fg sm:text-8xl">{shown === null ? "—" : format(shown)}</p>
        <p className="mt-4 max-w-sm text-lg text-fg-muted">{caption}</p>
        {delta && <p className={`mt-6 inline-flex rounded-full border border-line px-3 py-1 text-sm font-semibold ${hueText}`}>{delta}</p>}
      </div>
      <div className="relative hidden h-full min-h-0 items-center sm:flex">{children}</div>
    </article>
  );
}
