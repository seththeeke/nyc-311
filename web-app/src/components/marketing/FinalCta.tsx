import { useRef, type ReactElement } from "react";
import { EnterFleetButton } from "./EnterFleetButton";
import { FINAL_CTA } from "./marketingContent";
import { Reveal } from "./Reveal";
import { CityStrip } from "./finale/CityStrip";
import { useInView } from "./useInView";

interface FinalCtaProps {
  onEnter: () => void;
  reducedMotion: boolean;
}

/*
 * The closing call to action: a giant gradient headline over a breathing
 * aurora and a field of drifting stars, Enter fleet, and Patch the mascot
 * driving the city's streets along the bottom of the page.
 */
export function FinalCta({ onEnter, reducedMotion }: FinalCtaProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const playing = useInView(ref, 0.2) && !reducedMotion;
  return (
    <section aria-labelledby="final-cta-title" className="mk-lazy-section relative overflow-hidden pt-40 text-center">
      <div aria-hidden="true" className="mk-aurora pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="mk-stars pointer-events-none absolute inset-0" />
      <Reveal className="relative mx-auto max-w-4xl px-4 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-cyan">Your move</p>
        <h2 id="final-cta-title" className="mk-gradient-text mt-4 text-5xl font-black tracking-tight sm:text-8xl">
          {FINAL_CTA.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-fg-muted sm:text-xl">{FINAL_CTA.body}</p>
        <div className="mt-14">
          <EnterFleetButton onEnter={onEnter} size="LG" />
        </div>
      </Reveal>
      <div ref={ref} className="relative mt-20">
        <CityStrip playing={playing} />
      </div>
    </section>
  );
}
