import { useRef, type ReactElement } from "react";
import { EnterFleetButton } from "./EnterFleetButton";
import { KineticHeadline } from "./KineticHeadline";
import { SUBHEAD } from "./marketingContent";
import { useCityPulse } from "./useCityPulse";
import type { ThemeName } from "../../models/theme";

/* Once the headline and subhead have landed. */
const AUTO_SELECT_MS = 1700;

interface MarketingHeroProps {
  onEnter: () => void;
  reducedMotion: boolean;
  theme: ThemeName;
}

/*
 * The opening screen: the living street grid fills the background (calls
 * ping amber, trucks race to them, fixes burst green), with the kinetic
 * headline and the Enter fleet button over it.
 */
export function MarketingHero({ onEnter, reducedMotion, theme }: MarketingHeroProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCityPulse(canvasRef, reducedMotion, theme);
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden">
      <canvas ref={canvasRef} aria-hidden="true" data-testid="city-pulse" className="absolute inset-0 h-full w-full" />
      <div aria-hidden="true" className="mk-vignette pointer-events-none absolute inset-0" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-28 sm:px-8">
        <KineticHeadline />
        <p
          className="mt-8 max-w-2xl animate-[mk-rise_0.9s_ease-out_both] text-lg leading-relaxed text-fg-muted sm:text-xl"
          style={{ animationDelay: "900ms" }}
        >
          {SUBHEAD}
        </p>
        <div className="mt-12 flex animate-[mk-rise_0.9s_ease-out_both] flex-wrap items-center gap-x-14 gap-y-10" style={{ animationDelay: "1100ms" }}>
          <EnterFleetButton onEnter={onEnter} autoSelectDelayMs={reducedMotion ? 0 : AUTO_SELECT_MS} />
          <a href="#how-it-works" className="text-base font-medium text-fg-muted underline-offset-8 hover:text-fg hover:underline">
            See how it works
          </a>
        </div>
      </div>
      <div aria-hidden="true" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-[mk-float_2.4s_ease-in-out_infinite] text-fg-subtle">
        <span className="block h-10 w-6 rounded-full border-2 border-line-strong">
          <span className="mx-auto mt-2 block h-2 w-1 rounded-full bg-fg-subtle" />
        </span>
      </div>
    </section>
  );
}
