import type { ReactElement } from "react";
import { EnterFleetButton } from "./EnterFleetButton";
import { FINAL_CTA } from "./marketingContent";
import { Reveal } from "./Reveal";

interface FinalCtaProps {
  onEnter: () => void;
}

/* The closing call to action, over a slow-breathing aurora. */
export function FinalCta({ onEnter }: FinalCtaProps): ReactElement {
  return (
    <section aria-labelledby="final-cta-title" className="relative overflow-hidden px-4 py-40 text-center sm:px-8">
      <div aria-hidden="true" className="mk-aurora pointer-events-none absolute inset-0" />
      <Reveal className="relative mx-auto max-w-3xl">
        <h2 id="final-cta-title" className="text-5xl font-black tracking-tight text-fg sm:text-7xl">
          {FINAL_CTA.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-fg-muted">{FINAL_CTA.body}</p>
        <div className="mt-12">
          <EnterFleetButton onEnter={onEnter} size="LG" />
        </div>
      </Reveal>
    </section>
  );
}
