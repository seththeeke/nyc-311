import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useTeamSelection } from "../../../hooks/useTeamSelection";
import { PersonaAvatar } from "../../residents/PersonaAvatar";
import { memberById } from "../teamRoster";
import { TEAM_PATH } from "../teamRoutes";
import { WorkInProgressTag } from "../WorkInProgressTag";
import { MENTION_HANDLES } from "./chatChannels";

const LABEL = "text-[11px] font-medium uppercase tracking-wide text-fg-subtle";

/**
 * A team member's chat profile in the secondary workspace, like a Slack
 * profile: their avatar, who they are, and their one job, with a link to
 * their full card on Meet the Team.
 */
export function MemberProfilePanel({ memberId }: { memberId: string }): ReactElement {
  const { selectProfile } = useTeamSelection();
  const member = memberById(memberId);
  const close = (
    <button type="button" onClick={() => selectProfile(null)} aria-label="Close profile" className="rounded-lg px-2 py-1 text-fg-subtle hover:bg-panel-hover hover:text-fg">
      ×
    </button>
  );
  if (!member) {
    return (
      <section aria-label="Profile" className="px-4">
        <div className="flex justify-end">{close}</div>
        <p className="text-sm text-fg-muted">{memberId} isn&apos;t on the team roster.</p>
      </section>
    );
  }
  const manager = memberById(member.reports_to);
  const handle = MENTION_HANDLES[member.member_id];
  return (
    <section aria-label="Profile" className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 pb-2">
        <h2 className="font-semibold text-fg">Profile</h2>
        {close}
      </header>
      <div className="flex flex-col items-center gap-2 px-4 pt-5 text-center">
        {member.photo_url ? (
          <img src={member.photo_url} alt={member.name} className="size-24 rounded-full object-cover" />
        ) : (
          <PersonaAvatar name={member.name} modelKey={member.model_key} size="XL" />
        )}
        <p className="mt-1 text-lg font-semibold text-fg">{member.name}</p>
        <p className="text-sm text-fg-muted">{member.title}</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          <span className="rounded bg-panel-strong px-1.5 text-[10px] font-medium text-fg-subtle">{member.kind === "AGENT" ? "AGENT" : "HUMAN"}</span>
          {!member.live && <WorkInProgressTag />}
        </div>
      </div>
      <dl className="mt-5 space-y-3 px-4 text-sm">
        <div>
          <dt className={LABEL}>Role</dt>
          <dd className="mt-0.5 text-fg">{member.responsibility}</dd>
        </div>
        {member.kind === "AGENT" && (
          <div>
            <dt className={LABEL}>Character</dt>
            <dd className="mt-0.5 text-fg-muted">{member.character}</dd>
          </div>
        )}
        {handle && (
          <div>
            <dt className={LABEL}>Handle</dt>
            <dd className="mt-0.5 font-mono text-fg-muted">@{handle}</dd>
          </div>
        )}
        {manager && (
          <div>
            <dt className={LABEL}>Reports to</dt>
            <dd className="mt-0.5 text-fg-muted">{manager.title}</dd>
          </div>
        )}
      </dl>
      <Link to={`${TEAM_PATH}?member=${member.member_id}`} className="mx-4 mt-5 rounded-lg border border-line px-3 py-1.5 text-center text-sm font-medium text-fg hover:bg-panel-hover">
        View on Meet the Team
      </Link>
    </section>
  );
}
