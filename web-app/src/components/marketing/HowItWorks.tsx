import { useRef, type ReactElement } from "react";
import { JourneyCard } from "./JourneyCard";
import { JOURNEY_STEPS } from "./journeySteps";
import { stepAt, useStickyProgress } from "./useStickyProgress";

/* Scroll distance each step holds the stage for, as a share of the viewport height. */
const SCROLL_PER_STEP_VH = 55;

/*
 * "From call to curb" as a scroll story: the section pins a stage while the
 * visitor scrolls through it, and each slice of the scroll brings the next
 * large step card forward (the last tips back and away), with a segmented rail
 * filling as you go. Amber is the real city, cyan is BoroughSim.
 */
export function HowItWorks({ reducedMotion }: { reducedMotion: boolean }): ReactElement {
  const ref = useRef<HTMLElement>(null);
  const progress = useStickyProgress(ref);
  const count = JOURNEY_STEPS.length;
  const active = stepAt(progress, count);
  return (
    <section
      ref={ref}
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="relative"
      style={{ height: `calc(${count * SCROLL_PER_STEP_VH}vh + 100vh)` }}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col px-4 pb-8 pt-20 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-cyan">How it works</p>
              <h2 id="how-it-works-title" className="mt-2 text-3xl font-black tracking-tight text-fg sm:text-5xl">
                From call to curb.
              </h2>
            </div>
            <p className="flex gap-5 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-hue-amber" />The real city</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-hue-cyan" />BoroughSim</span>
            </p>
          </div>
          <ol aria-label="Journey progress" className="mt-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {JOURNEY_STEPS.map((step, i) => {
              const fill = Math.min(1, Math.max(0, progress * count - i));
              return (
                <li key={step.id} aria-current={i === active ? "step" : undefined} className="flex flex-col gap-2">
                  <span className="h-1 overflow-hidden rounded-full bg-panel-strong">
                    <span
                      data-testid={`rail-${step.id}`}
                      className={`block h-full origin-left rounded-full ${step.actor === "REAL_CITY" ? "bg-hue-amber" : "bg-hue-cyan"}`}
                      style={{ transform: `scaleX(${fill})` }}
                    />
                  </span>
                  <span className={`hidden text-xs font-semibold transition-colors sm:block ${i === active ? "text-fg" : "text-fg-subtle"}`}>{step.kicker}</span>
                </li>
              );
            })}
          </ol>
          <div className="relative mt-6 flex-1 [perspective:1600px]">
            {JOURNEY_STEPS.map((step, i) => (
              <JourneyCard key={step.id} step={step} index={i} offset={i - active} reducedMotion={reducedMotion} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
