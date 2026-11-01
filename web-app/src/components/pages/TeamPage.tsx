import { type ReactElement, useEffect } from "react";
import { useTeamSelection } from "../../hooks/useTeamSelection";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";
import { CeoCard } from "../team/CeoCard";
import { ExecutiveCard } from "../team/ExecutiveCard";
import { TEAM_ROSTER } from "../team/teamRoster";

const [CEO] = TEAM_ROSTER.filter((member) => member.kind === "HUMAN");
const AGENTS = TEAM_ROSTER.filter((member) => member.kind === "AGENT");

/**
 * Meet the Team (#146), behind MEET_THE_TEAM: BoroughSim's one human CEO
 * and its AI agents, one large card each. `?member=` scrolls to a card;
 * View Contributions opens that member's log in the secondary workspace.
 */
export function TeamPage(): ReactElement {
  const { memberId, selectMember, selectContributions } = useTeamSelection();
  useEffect(() => {
    if (memberId) document.getElementById(`member-${memberId}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [memberId]);
  return (
    <main className={PAGE_CONTENT_CLASSES}>
      <header className="rounded-3xl border border-line bg-panel px-6 py-10 text-center lg:px-12">
        <h1 className="text-3xl font-semibold text-fg lg:text-4xl">Meet the Team</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-fg-muted">An agent-run business: one human CEO and a team of AI agents, each built for one job.</p>
        <nav aria-label="Jump to" className="mt-6 flex flex-wrap justify-center gap-2">
          {AGENTS.map((member) => (
            <button
              key={member.member_id}
              type="button"
              onClick={() => selectMember(member.member_id)}
              aria-current={member.member_id === memberId ? "true" : undefined}
              className="rounded-full border border-line px-3 py-1 text-xs text-fg-muted transition-colors hover:bg-panel-hover hover:text-fg aria-[current=true]:border-violet-400/60 aria-[current=true]:text-fg"
            >
              {member.short_title}
            </button>
          ))}
        </nav>
      </header>
      <CeoCard member={CEO} />
      <div className="mt-8 space-y-8">
        {AGENTS.map((member, index) => (
          <ExecutiveCard key={member.member_id} member={member} flip={index % 2 === 1} onViewContributions={selectContributions} />
        ))}
      </div>
    </main>
  );
}
