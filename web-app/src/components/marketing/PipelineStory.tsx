import { useRef, type ReactElement } from "react";
import { PIPELINE_STAGES } from "./marketingContent";
import { Reveal } from "./Reveal";
import { useScrollProgress } from "./useScrollProgress";

/* A stage lights up once the scroll-driven line reaches its column: stage i of n starts i/n of the way along. */
export function stageLit(index: number, count: number, progress: number): boolean {
  return progress >= index / Math.max(1, count);
}

/*
 * "From call to curb": the five stages a complaint goes through, joined by
 * a line that draws itself as you scroll, with a glowing head riding its tip.
 */
export function PipelineStory(): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);
  const percent = `${progress * 100}%`;
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="mx-auto max-w-6xl px-4 py-32 sm:px-8">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-cyan">How it works</p>
        <h2 id="how-it-works-title" className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-fg sm:text-6xl">
          From call to curb.
        </h2>
      </Reveal>
      <div ref={ref} className="relative mt-20">
        <div aria-hidden="true" className="absolute left-5 top-0 h-full w-px bg-line md:left-0 md:top-5 md:h-px md:w-full">
          <div className="mk-beam absolute left-0 top-0 w-full md:hidden" style={{ height: percent }} />
          <div className="mk-beam absolute left-0 top-0 hidden h-full md:block" style={{ width: percent }} />
          <span
            className="absolute -ml-[5px] -mt-[5px] hidden h-[11px] w-[11px] rounded-full bg-hue-cyan shadow-[0_0_24px_6px_var(--t-hue-cyan)] md:block"
            style={{ left: percent }}
          />
        </div>
        <ol className="grid gap-12 md:grid-cols-5 md:gap-6">
          {PIPELINE_STAGES.map((stage, i) => {
            const lit = stageLit(i, PIPELINE_STAGES.length, progress);
            return (
              <li key={stage.id} data-lit={lit} className="relative pl-16 md:pl-0 md:pt-16">
                <span
                  className={`absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold transition-all duration-500 ${lit ? "scale-110 border-hue-cyan bg-hue-cyan text-surface shadow-[0_0_30px_var(--t-hue-cyan)]" : "border-line-strong bg-surface text-fg-subtle"}`}
                >
                  {stage.label}
                </span>
                <h3 className={`text-lg font-bold transition-colors duration-500 ${lit ? "text-fg" : "text-fg-subtle"}`}>{stage.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{stage.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
