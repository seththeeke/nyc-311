import type { ReactElement } from "react";
import type { JourneySceneId, JourneyStep } from "./journeySteps";
import { EstimateScene } from "./scenes/EstimateScene";
import { RealDataScene } from "./scenes/RealDataScene";
import { ResolveScene } from "./scenes/ResolveScene";
import { ScheduleScene } from "./scenes/ScheduleScene";
import { ServiceabilityScene } from "./scenes/ServiceabilityScene";

interface JourneyCardProps {
  step: JourneyStep;
  index: number;
  /* Where this card sits against the current step: negative is already passed, positive is still to come. */
  offset: number;
  reducedMotion: boolean;
}

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

/* A passed card tips back and fades up; the next waits below; the current one sits square. */
export function cardTransform(offset: number): { transform: string; opacity: number } {
  if (offset === 0) return { transform: "translateY(0) scale(1) rotateX(0deg)", opacity: 1 };
  if (offset < 0) return { transform: "translateY(-14%) scale(0.88) rotateX(14deg)", opacity: 0 };
  return { transform: "translateY(26%) scale(0.94) rotateX(-10deg)", opacity: 0 };
}

/*
 * One step of the journey as a large card: the step's copy on one side, its
 * animated scene on the other. The scene mounts only while the card is
 * current, so its animation plays each time the scroll brings it in.
 */
export function JourneyCard({ step, index, offset, reducedMotion }: JourneyCardProps): ReactElement {
  const current = offset === 0;
  const realCity = step.actor === "REAL_CITY";
  const { transform, opacity } = cardTransform(offset);
  return (
    <article
      aria-hidden={!current}
      data-current={current}
      data-actor={step.actor}
      style={{ transform, opacity }}
      className={`mk-stage absolute inset-0 grid origin-top gap-6 overflow-hidden rounded-[2rem] border p-6 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:p-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)] lg:gap-12 ${realCity ? "border-hue-amber/50 shadow-[0_0_120px_-30px_var(--t-hue-amber)]" : "border-hue-cyan/30 shadow-[0_0_120px_-40px_var(--t-hue-cyan)]"} ${current ? "" : "pointer-events-none"}`}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl ${realCity ? "bg-hue-amber/20" : "bg-hue-cyan/15"}`} />
      <div className="relative flex flex-col justify-center">
        <p className={`text-7xl font-black leading-none sm:text-8xl ${realCity ? "text-hue-amber" : "mk-gradient-text"}`}>{String(index + 1).padStart(2, "0")}</p>
        <p className={`mt-6 text-sm font-bold uppercase tracking-[0.25em] ${realCity ? "text-hue-amber" : "text-hue-cyan"}`}>{step.kicker}</p>
        <h3 className="mt-2 text-3xl font-black tracking-tight text-fg sm:text-5xl">{step.title}</h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-fg-muted sm:text-lg">{step.body}</p>
      </div>
      <div className="relative hidden min-h-0 sm:block">{current && <Scene id={step.id} instant={reducedMotion} />}</div>
    </article>
  );
}
