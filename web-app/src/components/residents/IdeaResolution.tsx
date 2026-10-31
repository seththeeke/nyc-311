import type { ReactElement } from "react";
import type { IdeaStep, ResidentIdea } from "../../models/residentIdea";
import { IdeaStepNode } from "./IdeaStepNode";
import { durationLabel } from "./residentFormat";
import { ResolutionBadge } from "./ResolutionBadge";

/**
 * Idea Resolution on the Idea Detail view (docs/16-resident-action-models.md
 * §6.1): how it ended, in the resident's own words, then each turn they
 * took, in order.
 */
export function IdeaResolution({ idea, steps }: { idea: ResidentIdea; steps: IdeaStep[] }): ReactElement {
  const { resolution } = idea;
  return (
    <section aria-label="Idea Resolution" className="mt-4 rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-fg">Idea Resolution</h2>
        <ResolutionBadge resolution={resolution} />
      </div>
      {resolution.status === "NOT_ACTIONED" ? (
        <p className="mt-2 text-sm text-fg-muted">Nothing yet. The resident hasn&apos;t acted on this idea.</p>
      ) : (
        <>
          {resolution.summary && (
            <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm italic text-fg">&ldquo;{resolution.summary}&rdquo;</blockquote>
          )}
          {resolution.follow_up && <p className="mt-2 text-sm text-fg-muted">Will follow up: {resolution.follow_up}</p>}
          <p className="mt-2 text-xs text-fg-subtle">
            {resolution.started_at && `Started ${new Date(resolution.started_at).toLocaleString()} · `}
            {resolution.finished_at ? `took ${durationLabel(resolution.started_at, resolution.finished_at)} · ` : ""}
            {resolution.step_count} step{resolution.step_count === 1 ? "" : "s"}
          </p>
          <ol aria-label="Workstream" className="mt-4">
            {steps.map((step) => (
              <IdeaStepNode key={step.sequence} step={step} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
