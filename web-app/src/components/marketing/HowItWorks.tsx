import { useRef, type ReactElement } from "react";
import { JOURNEY_STEPS, type JourneySceneId } from "./journeySteps";
import { Reveal } from "./Reveal";
import { useInView } from "./useInView";
import { useJourney } from "./useJourney";
import { EstimateScene } from "./scenes/EstimateScene";
import { RealDataScene } from "./scenes/RealDataScene";
import { ResolveScene } from "./scenes/ResolveScene";
import { ScheduleScene } from "./scenes/ScheduleScene";
import { ServiceabilityScene } from "./scenes/ServiceabilityScene";

const STEP_MS = 6000;

function Scene({ id, instant }: { id: JourneySceneId; instant: boolean }): ReactElement {
  switch (id) {
    case "REAL_DATA":
      return <RealDataScene />;
    case "SERVICEABILITY":
      return <ServiceabilityScene />;
    case "ESTIMATE":
      return <EstimateScene instant={instant} />;
    case "SCHEDULE":
      return <ScheduleScene />;
    case "RESOLVE":
      return <ResolveScene />;
  }
}

/*
 * "From call to curb": one 311 call's journey as an auto-playing story. The
 * step list doubles as tabs with a filling progress bar; the stage replays its
 * scene on every change. Amber is the real city, cyan is BoroughSim.
 */
export function HowItWorks({ reducedMotion }: { reducedMotion: boolean }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.35);
  const { active, paused, select, setPaused } = useJourney(JOURNEY_STEPS.length, STEP_MS, inView && !reducedMotion);
  const step = JOURNEY_STEPS[active];
  const realCity = step.actor === "REAL_CITY";
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="mx-auto max-w-6xl px-4 py-32 sm:px-8">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-cyan">How it works</p>
        <h2 id="how-it-works-title" className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-fg sm:text-6xl">
          From call to curb.
        </h2>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-hue-amber" />The real city</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-hue-cyan" />BoroughSim</span>
        </p>
      </Reveal>
      <div
        ref={ref}
        className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <div role="tablist" aria-label="Journey steps" className="flex flex-col gap-2">
          {JOURNEY_STEPS.map((s, i) => {
            const selected = i === active;
            const amber = s.actor === "REAL_CITY";
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`journey-tab-${s.id}`}
                aria-selected={selected}
                aria-controls="journey-stage"
                onClick={() => select(i)}
                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-500 ${selected ? (amber ? "border-hue-amber/60 bg-hue-amber/10" : "border-hue-cyan/60 bg-hue-cyan/10") : "border-line hover:border-line-strong"}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${amber ? "bg-hue-amber text-surface" : selected ? "bg-hue-cyan text-surface" : "bg-panel-strong text-fg-muted"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-bold uppercase tracking-widest ${amber ? "text-hue-amber" : "text-hue-cyan"}`}>{s.kicker}</span>
                    <span className={`block font-bold ${selected ? "text-fg" : "text-fg-muted"}`}>{s.title}</span>
                  </span>
                </span>
                {selected && <span className="mt-2 block pl-11 text-sm leading-relaxed text-fg-muted">{s.body}</span>}
                {selected && inView && !paused && !reducedMotion && (
                  <span
                    key={`${active}`}
                    aria-hidden="true"
                    className={`absolute bottom-0 left-0 h-0.5 w-full origin-left animate-[mk-grow_linear_both] ${amber ? "bg-hue-amber" : "bg-hue-cyan"}`}
                    style={{ animationDuration: `${STEP_MS}ms` }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div
          id="journey-stage"
          role="tabpanel"
          aria-labelledby={`journey-tab-${step.id}`}
          className={`mk-stage relative min-h-[28rem] overflow-hidden rounded-3xl border p-6 transition-colors duration-700 sm:p-8 ${realCity ? "border-hue-amber/40" : "border-hue-cyan/30"}`}
          data-actor={step.actor}
        >
          <div aria-hidden="true" className={`pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl transition-colors duration-700 ${realCity ? "bg-hue-amber/20" : "bg-hue-cyan/15"}`} />
          <div key={step.id} className="relative h-full animate-[mk-rise_0.6s_ease-out_both]">
            <Scene id={step.id} instant={reducedMotion} />
          </div>
        </div>
      </div>
    </section>
  );
}
