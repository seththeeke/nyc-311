import type { ReactElement } from "react";
import { useTeamSelection } from "../../hooks/useTeamSelection";
import { CONTRIBUTION_LABEL, contributionsFor } from "./teamContributions";
import { clockTime, meetingDay } from "./teamFormat";
import { memberById } from "./teamRoster";

/** A team member's recent contributions (#146), in the secondary workspace: what they did, why, and where to see it. */
export function ContributionsPanel(): ReactElement {
  const { contributionsId, selectContributions } = useTeamSelection();
  const member = memberById(contributionsId);
  if (!member) return <p className="px-4 text-sm text-fg-muted">Pick View Contributions on anyone to see what they&apos;ve been doing.</p>;
  const items = contributionsFor(member.member_id);
  return (
    <section aria-label={`${member.name}'s contributions`} className="px-4 pb-4">
      <header className="flex items-start justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Contributions</p>
          <h2 className="font-semibold text-fg">{member.title}</h2>
          <p className="text-xs text-fg-muted">{member.name}</p>
        </div>
        <button type="button" onClick={() => selectContributions(null)} aria-label="Close contributions" className="rounded-lg px-2 py-1 text-fg-subtle hover:bg-panel-hover hover:text-fg">
          ×
        </button>
      </header>
      <ol className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.contribution_id} className="rounded-xl border border-line bg-panel p-3">
            <p className="flex items-center justify-between gap-2 text-[11px] text-fg-subtle">
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-medium text-hue-cyan">{CONTRIBUTION_LABEL[item.kind]}</span>
              <time dateTime={item.at}>
                {meetingDay(item.at.slice(0, 10))} · {clockTime(item.at)}
              </time>
            </p>
            <p className="mt-2 text-sm font-medium text-fg">{item.title}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{item.detail}</p>
            {item.link && (
              <a href={item.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-hue-indigo hover:underline">
                Open on GitHub
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
