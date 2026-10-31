import type { ReactElement } from "react";
import type { IdeaResolution } from "../../models/residentIdea";
import { RESOLUTION_LABELS, resolutionState, type ResolutionBadgeState } from "./residentFormat";

/* Theme tokens per state: finished well, finished badly, still going, or nothing yet. */
const TONES: Record<ResolutionBadgeState, string> = {
  NOT_ACTIONED: "text-fg-subtle italic ring-line",
  IN_PROGRESS: "text-fg-muted ring-line",
  STALLED: "text-danger ring-line",
  SATISFIED: "text-hue-emerald ring-line",
  UNSATISFIED: "text-danger ring-line",
  GAVE_UP: "text-fg-muted ring-line",
  MAX_DEPTH_REACHED: "text-fg-muted ring-line",
};

/** How an idea was resolved, as one small badge (docs/16 §6.1). */
export function ResolutionBadge({ resolution, now }: { resolution: IdeaResolution; now?: Date }): ReactElement {
  const state = resolutionState(resolution, now);
  return (
    <span data-state={state} className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs ring-1 ${TONES[state]}`}>
      {RESOLUTION_LABELS[state]}
    </span>
  );
}
