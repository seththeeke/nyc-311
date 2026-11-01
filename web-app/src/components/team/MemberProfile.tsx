import { lazy, Suspense, type ReactElement } from "react";
import type { TeamMember } from "../../models/teamMember";
import { isWebGlAvailable } from "../three/webgl";
import { METRIC_LABEL } from "./teamFormat";
import { memberById } from "./teamRoster";

const ResidentStage = lazy(() => import("../residents/ResidentStage"));

interface MemberProfileProps {
  member: TeamMember;
  onClose: () => void;
}

/** One member in full: their figure on stage, what they're for, where they push back and what they're measured on. */
export function MemberProfile({ member, onClose }: MemberProfileProps): ReactElement {
  const showStage = member.model_key !== null && isWebGlAvailable();
  const manager = memberById(member.reports_to);
  return (
    <section aria-label={member.name} className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg">{member.name}</h2>
          <p className="text-sm text-fg-muted">{member.title}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close profile" className="rounded-lg px-2 py-1 text-fg-subtle hover:bg-panel-hover hover:text-fg">
          ×
        </button>
      </div>
      <div className="mt-3 flex flex-col items-center gap-4">
        {showStage && member.model_key && (
          <Suspense fallback={<div className="h-64 w-48 shrink-0" />}>
            <ResidentStage name={member.name} modelKey={member.model_key} />
          </Suspense>
        )}
        <div className="w-full min-w-0">
          <p className="text-sm italic text-fg">“{member.tagline}”</p>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{member.bio}</p>
          <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-fg-subtle">Mandate</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-fg-muted">
            {member.mandate.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-fg-subtle">Pushes back on</h3>
          <p className="mt-1 text-sm text-fg-muted">{member.pushes_back_on}</p>
          {member.owns_metrics.length > 0 && (
            <ul aria-label="Owns" className="mt-3 flex flex-wrap gap-1.5">
              {member.owns_metrics.map((metric) => (
                <li key={metric} className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] text-hue-cyan">
                  {METRIC_LABEL[metric]}
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-4 space-y-1 text-xs">
            {member.agent_name && (
              <div className="flex gap-2">
                <dt className="text-fg-subtle">Agent</dt>
                <dd className="font-mono text-fg-muted">{member.agent_name}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-fg-subtle">Runs</dt>
              <dd className="text-fg-muted">{member.cadence}</dd>
            </div>
            {manager && (
              <div className="flex gap-2">
                <dt className="text-fg-subtle">Reports to</dt>
                <dd className="text-fg-muted">{manager.name}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
