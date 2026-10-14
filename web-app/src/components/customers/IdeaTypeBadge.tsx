import type { ReactElement } from "react";
import type { IdeaType } from "../../models/customerIdea";
import { IDEA_TYPE_STYLES } from "./customerFormat";

/** The idea's type as a coloured pill. */
export function IdeaTypeBadge({ type }: { type: IdeaType }): ReactElement {
  const style = IDEA_TYPE_STYLES[type];
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${style.classes}`}>{style.label}</span>;
}
