import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useFeatureEnabled } from "../../hooks/useFeatureTreatment";
import { MEET_THE_TEAM_FLAG, MEET_THE_TEAM_ON } from "../../models/featureTreatment";
import type { TeamMember } from "../../models/teamMember";
import { PersonaAvatar } from "../residents/PersonaAvatar";
import { TEAM_ROSTER } from "../team/teamRoster";
import { TEAM_PATH } from "../team/teamRoutes";
import { AGENT_SECTION } from "./marketingContent";
import { Reveal } from "./Reveal";

/* The executive team only: the engineers stay off the ring. */
export const EXECUTIVES: readonly TeamMember[] = TEAM_ROSTER.filter((member) => member.role !== "ENGINEER");

/* Where member `index` of `count` sits on the ring, in degrees, starting from 12 o'clock. */
export function orbitAngle(index: number, count: number): number {
  return (360 / Math.max(1, count)) * index - 90;
}

/* A member's face on the ring: the CEO's photo, or the agent's figure (its initial without WebGL). */
function OrbitAvatar({ member }: { member: TeamMember }): ReactElement {
  if (member.photo_url) return <img src={member.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />;
  return <PersonaAvatar name={member.name} modelKey={member.model_key} size="LG" />;
}

/*
 * The executive team as a slow orbit around the company: every member rides
 * the ring while counter-rotating, so faces and names stay upright. Hovering
 * the ring pauses it. Meet the Team shows while its page's flag is on.
 */
export function AgentOrbit(): ReactElement {
  const agents = EXECUTIVES.filter((member) => member.kind === "AGENT").length;
  const teamPageOn = useFeatureEnabled(MEET_THE_TEAM_FLAG, MEET_THE_TEAM_ON);
  return (
    <section aria-labelledby="agents-title" className="relative overflow-hidden py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-hue-violet">{AGENT_SECTION.eyebrow}</p>
          <h2 id="agents-title" className="mt-4 text-4xl font-black tracking-tight text-fg sm:text-6xl">
            {AGENT_SECTION.title}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">{AGENT_SECTION.body}</p>
          {teamPageOn && (
            <Link
              to={TEAM_PATH}
              className="mt-10 inline-flex items-center gap-3 rounded-full border border-line-strong bg-panel px-6 py-3 font-semibold text-fg backdrop-blur transition-colors hover:border-hue-violet hover:text-hue-violet"
            >
              Meet the Team
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </Reveal>
        <div className="group relative mx-auto aspect-square w-full max-w-[32rem] [--orbit-r:min(38vw,13.5rem)]">
          <div aria-hidden="true" className="absolute inset-[8%] rounded-full border border-dashed border-line-strong" />
          <div aria-hidden="true" className="absolute inset-[30%] rounded-full border border-line" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="mk-gradient-text text-6xl font-black">1 + {agents}</p>
            <p className="mt-1 text-sm uppercase tracking-widest text-fg-subtle">human + agents</p>
          </div>
          <ul className="absolute inset-0 animate-[mk-orbit_60s_linear_infinite] group-hover:[animation-play-state:paused]">
            {EXECUTIVES.map((member, i) => (
              <li
                key={member.member_id}
                className="absolute left-1/2 top-1/2"
                style={{ transform: `rotate(${orbitAngle(i, EXECUTIVES.length)}deg) translateX(var(--orbit-r)) rotate(${-orbitAngle(i, EXECUTIVES.length)}deg)` }}
              >
                <div className="-translate-x-1/2 -translate-y-1/2 animate-[mk-orbit-reverse_60s_linear_infinite] group-hover:[animation-play-state:paused]">
                  <div className="glass flex flex-col items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2.5 text-center transition-transform duration-300 hover:scale-110">
                    <OrbitAvatar member={member} />
                    <p className="text-sm font-bold text-fg">{member.name}</p>
                    <p className={`text-xs ${member.kind === "HUMAN" ? "text-hue-amber" : "text-hue-cyan"}`}>{member.short_title}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
