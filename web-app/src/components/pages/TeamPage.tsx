import type { ReactElement } from "react";
import { useTeamSelection } from "../../hooks/useTeamSelection";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";
import { MemberProfile } from "../team/MemberProfile";
import { OrgChart } from "../team/OrgChart";
import { StaffMeetingSection } from "../team/StaffMeetingSection";
import { TeamGoalCard } from "../team/TeamGoalCard";
import { memberById } from "../team/teamRoster";

/**
 * Meet the Team (#146), behind MEET_THE_TEAM: BoroughSim's one human CEO
 * and AI executive team as an org chart, each member's profile, and the
 * daily Staff Meeting they hold on the Mac mini.
 */
export function TeamPage(): ReactElement {
  const { memberId, selectMember } = useTeamSelection();
  const member = memberById(memberId);
  return (
    <main className={PAGE_CONTENT_CLASSES}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Meet the Team</h1>
        <p className="mt-1 text-sm text-fg-muted">One human CEO and an executive team of AI agents, running BoroughSim from a Mac mini.</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <OrgChart selectedId={member?.member_id ?? null} onSelect={selectMember} />
        {member ? <MemberProfile member={member} onClose={() => selectMember(null)} /> : <TeamGoalCard />}
      </div>
      <StaffMeetingSection />
    </main>
  );
}
