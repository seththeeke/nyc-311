import type { ReactElement } from "react";
import type { IdeaAction } from "../../models/customerIdea";
import { ACTION_TYPE_LABELS, NOT_ACTIONED_LABEL } from "./customerFormat";

/** What the resident did about an idea, as one neutral tag — the same look for every action, so none reads as more urgent. */
export function IdeaActionTag({ action }: { action: IdeaAction | null }): ReactElement {
  const label = action ? ACTION_TYPE_LABELS[action.type] : NOT_ACTIONED_LABEL;
  const failed = action?.status === "FAILED";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs ring-1 ring-line ${action ? "text-fg-muted" : "text-fg-subtle italic"}`}>
      {label}
      {failed && " · failed"}
    </span>
  );
}
