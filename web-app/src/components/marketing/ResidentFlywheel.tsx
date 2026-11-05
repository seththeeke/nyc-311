import type { ReactElement } from "react";
import { FLYWHEEL_STEPS } from "./marketingContent";
import { useTicker } from "./useTicker";
import { orbitAngle } from "./AgentOrbit";

const STEP_MS = 2600;
/* The comet's hop between stations; a station lights as the comet lands. */
const HOP_MS = 900;

/*
 * The business flywheel: five stations on a ring, a comet that sweeps from
 * one to the next, and the station it reaches lighting up with its caption.
 * Reduced motion holds on the first station.
 */
export function ResidentFlywheel({ playing }: { playing: boolean }): ReactElement {
  const tick = useTicker(STEP_MS, playing);
  const count = FLYWHEEL_STEPS.length;
  const active = tick % count;
  const step = FLYWHEEL_STEPS[active];
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative aspect-square w-full max-w-[24rem] [--wheel-r:min(36vw,10rem)]">
        <div aria-hidden="true" className="absolute inset-[10%] rounded-full border-2 border-dashed border-line-strong" />
        <div
          aria-hidden="true"
          data-testid="flywheel-comet"
          className="absolute inset-0 transition-transform ease-in-out"
          style={{ transform: `rotate(${tick * (360 / count)}deg)`, transitionDuration: `${HOP_MS}ms` }}
        >
          <span className="absolute left-1/2 top-[10%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hue-rose shadow-[0_0_30px_10px_var(--t-hue-rose)]" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-fg-subtle">The</p>
          <p className="mk-gradient-text text-3xl font-black">Flywheel</p>
        </div>
        <ol aria-label="The resident flywheel">
          {FLYWHEEL_STEPS.map((s, i) => {
            const lit = i === active;
            const angle = orbitAngle(i, count);
            return (
              <li
                key={s.title}
                aria-current={lit ? "step" : undefined}
                className="absolute left-1/2 top-1/2"
                style={{ transform: `rotate(${angle}deg) translateX(var(--wheel-r)) rotate(${-angle}deg)` }}
              >
                <span
                  style={{ transitionDelay: lit ? `${HOP_MS - 150}ms` : "0ms" }}
                  className={`flex -translate-x-1/2 -translate-y-1/2 items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-500 ${lit ? "scale-110 border-hue-rose bg-hue-rose text-surface shadow-[0_0_30px_var(--t-hue-rose)]" : "border-line-strong bg-surface text-fg-muted"}`}
                >
                  {i + 1} · {s.title}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p key={active} aria-live="polite" className="min-h-[3rem] max-w-sm animate-[mk-rise_0.6s_ease-out_both] text-center text-fg-muted">
        {step.body}
      </p>
    </div>
  );
}
