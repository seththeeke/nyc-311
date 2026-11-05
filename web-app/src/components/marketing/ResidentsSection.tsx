import { useRef, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useResidentIdeas } from "../../hooks/useResidentIdeas";
import { useResidentPersonas } from "../../hooks/useResidentPersonas";
import { RESIDENTS_PATH } from "../residents/residentRoutes";
import { FEATURED_RESIDENT_IDS, RESIDENTS_SECTION } from "./marketingContent";
import { Reveal } from "./Reveal";
import { ResidentCrowd } from "./ResidentCrowd";
import { ResidentFlywheel } from "./ResidentFlywheel";
import { useInView } from "./useInView";
import { AVATAR_LEAD } from "./AgentOrbit";

/*
 * The demand side: five featured residents (live from the customer's read API),
 * their latest real ideas, and the flywheel their needs drive through the company.
 */
export function ResidentsSection({ reducedMotion }: { reducedMotion: boolean }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const playing = useInView(ref, 0.25) && !reducedMotion;
  const sectionRef = useRef<HTMLElement>(null);
  const near = useInView(sectionRef, 0, AVATAR_LEAD);
  const { data: personas } = useResidentPersonas();
  const { data: ideas } = useResidentIdeas(null);
  const featured = FEATURED_RESIDENT_IDS.map((id) => personas?.find((p) => p.persona_id === id)).filter((p) => p !== undefined);
  const featuredIdeas = (ideas ?? []).filter((idea) => FEATURED_RESIDENT_IDS.includes(idea.persona_id));
  return (
    <section ref={sectionRef} aria-labelledby="residents-title" className="mk-lazy-section relative mx-auto max-w-6xl px-4 py-32 sm:px-8">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-rose">{RESIDENTS_SECTION.eyebrow}</p>
        <h2 id="residents-title" className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-fg sm:text-6xl">
          {RESIDENTS_SECTION.title}
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-fg-muted">{RESIDENTS_SECTION.body}</p>
        <Link
          to={RESIDENTS_PATH}
          className="mt-8 inline-flex items-center gap-3 rounded-full border border-line-strong bg-panel px-6 py-3 font-semibold text-fg backdrop-blur transition-colors hover:border-hue-rose hover:text-hue-rose"
        >
          Meet the residents
          <span aria-hidden="true">→</span>
        </Link>
      </Reveal>
      <div ref={ref} className="mt-16 grid items-center gap-16 lg:grid-cols-2">
        <ResidentCrowd personas={featured} ideas={featuredIdeas} playing={playing} drawAvatars={near} />
        <ResidentFlywheel playing={playing} />
      </div>
    </section>
  );
}
