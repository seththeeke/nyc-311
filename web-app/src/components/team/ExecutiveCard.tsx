import { lazy, Suspense, type ReactElement, useRef } from "react";
import type { TeamMember } from "../../models/teamMember";
import { isWebGlAvailable } from "../three/webgl";
import { memberById } from "./teamRoster";
import { WorkInProgressTag } from "./WorkInProgressTag";
import { useInView } from "./useInView";

const TeamStage = lazy(() => import("./TeamStage"));

interface ExecutiveCardProps {
  member: TeamMember;
  /* Alternate cards put the figure on the right. */
  flip: boolean;
  /* Null while AGENT_CONTRIBUTIONS is off: the card shows no View Contributions button. */
  onViewContributions: ((memberId: string) => void) | null;
}

const LABEL = "text-xs font-medium uppercase tracking-wide text-fg-subtle";

/* The figure performing (only while on screen), or an initial without WebGL. */
function Portrait({ member, inView }: { member: TeamMember; inView: boolean }): ReactElement | null {
  if (member.model_key !== null && isWebGlAvailable()) {
    return inView ? (
      <Suspense fallback={<div className="h-[26rem] w-full max-w-xs" />}>
        <TeamStage name={member.name} modelKey={member.model_key} />
      </Suspense>
    ) : null;
  }
  return (
    <span aria-hidden="true" className="flex size-40 items-center justify-center rounded-full bg-panel text-6xl font-semibold text-fg-muted">
      {member.name.charAt(0)}
    </span>
  );
}

/**
 * One agent, large (#146): their title up front, their one job,
 * and the goals they're measured on. The card rises into place the first
 * time it scrolls into view.
 */
export function ExecutiveCard({ member, flip, onViewContributions }: ExecutiveCardProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  const { inView, seen } = useInView(ref);
  const manager = memberById(member.reports_to);
  return (
    <article
      ref={ref}
      id={`member-${member.member_id}`}
      aria-label={member.title}
      className={`grid scroll-mt-6 overflow-hidden rounded-3xl border border-line bg-panel shadow-sm transition-all duration-700 ease-out motion-reduce:transition-none ${flip ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "lg:grid-cols-[22rem_minmax(0,1fr)]"} ${
        seen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
      }`}
    >
      <div className={`flex min-h-[18rem] items-center justify-center bg-panel-hover ${flip ? "lg:order-2" : ""}`}>
        <Portrait member={member} inView={inView} />
      </div>
      <div className="flex min-w-0 flex-col p-6 lg:p-8">
        <h2 className="flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight text-fg">
          {member.title}
          {!member.live && <WorkInProgressTag />}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {member.name} · <span className="italic">{member.character}</span>
        </p>
        <h3 className={`${LABEL} mt-6`}>Responsibility</h3>
        <p className="mt-2 text-base leading-relaxed text-fg">{member.responsibility}</p>
        {member.goals.length > 0 && (
          <>
          <h3 className={`${LABEL} mt-6`}>{member.goals.length === 1 ? "Goal" : "Goals"}</h3>
          <ul className="mt-2 space-y-2">
            {member.goals.map((goal) => (
              <li key={goal.goal} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-3">
                <span className="text-sm text-fg">{goal.goal}</span>
                <span className="text-xs text-fg-muted">
                  {goal.metric} <span className="ml-1 rounded-full bg-cyan-500/10 px-2 py-0.5 font-semibold text-hue-cyan">{goal.target}</span>
                </span>
              </li>
            ))}
          </ul>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs">
          <dl className="flex flex-wrap gap-x-6 gap-y-1">
            {member.agent_name && (
              <div className="flex gap-2">
                <dt className="text-fg-subtle">Agent</dt>
                <dd className="font-mono text-fg-muted">{member.agent_name}</dd>
              </div>
            )}
            {manager && (
              <div className="flex gap-2">
                <dt className="text-fg-subtle">Reports to</dt>
                <dd className="text-fg-muted">{manager.title}</dd>
              </div>
            )}
          </dl>
          {onViewContributions && (
            <button
              type="button"
              onClick={() => onViewContributions(member.member_id)}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-fg hover:bg-panel-hover"
            >
              View Contributions
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
