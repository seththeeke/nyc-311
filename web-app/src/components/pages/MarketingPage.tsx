import type { ReactElement } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useTheme } from "../../hooks/useTheme";
import { AgentOrbit } from "../marketing/AgentOrbit";
import { FinalCta } from "../marketing/FinalCta";
import { MarketingHero } from "../marketing/MarketingHero";
import { HowItWorks } from "../marketing/HowItWorks";
import { ResidentsSection } from "../marketing/ResidentsSection";
import { WeeklyStory } from "../marketing/weekly/WeeklyStory";

interface MarketingPageProps {
  /** Leaves the marketing page for the fleet map. */
  onEnter: () => void;
}

/*
 * The marketing page at / (MARKETING_PAGE = T1): a full-screen takeover
 * outside the app shell, scrolling through the hero, the executive team,
 * how a call becomes a repair, the residents and their flywheel, and the weekly snapshot, ending on Enter fleet.
 */
export function MarketingPage({ onEnter }: MarketingPageProps): ReactElement {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { theme } = useTheme();
  return (
    <div className="mk-motion fixed inset-0 z-50 overflow-y-auto overflow-x-hidden scroll-smooth bg-surface text-fg">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center px-4 py-5 sm:px-8">
        <p className="pointer-events-auto text-lg font-black tracking-tight text-fg">
          Borough<span className="text-hue-cyan">Sim</span>
        </p>
      </header>
      <main>
        <MarketingHero onEnter={onEnter} reducedMotion={reducedMotion} theme={theme} />
        <AgentOrbit />
        <HowItWorks reducedMotion={reducedMotion} />
        <ResidentsSection reducedMotion={reducedMotion} />
        <WeeklyStory reducedMotion={reducedMotion} />
        <FinalCta onEnter={onEnter} reducedMotion={reducedMotion} />
      </main>
      <footer className="border-t border-line px-4 py-10 text-center text-sm text-fg-subtle sm:px-8">
        BoroughSim runs on public NYC 311 data. The fleet, the company and its executives are simulated.
      </footer>
    </div>
  );
}
