import type { ReactElement } from "react";
import { IDEA_TYPES, type IdeaType } from "../../models/customerIdea";
import { IDEA_TYPE_STYLES } from "./customerFormat";

interface IdeaFiltersProps {
  ideaType: IdeaType | null;
  /** How many of the currently shown ideas are of each type. */
  counts: Record<IdeaType, number>;
  total: number;
  onSelectType: (ideaType: IdeaType | null) => void;
}

const CHIP = "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors";

/** Narrow the feed to one kind of need. */
export function IdeaFilters({ ideaType, counts, total, onSelectType }: IdeaFiltersProps): ReactElement {
  const chipClass = (active: boolean): string =>
    `${CHIP} ${active ? "bg-blue-600/15 text-fg ring-blue-500/50" : "text-fg-muted ring-line hover:text-fg"}`;
  return (
    <div role="group" aria-label="Filter ideas by type" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={ideaType === null} onClick={() => onSelectType(null)} className={chipClass(ideaType === null)}>
        All {total}
      </button>
      {IDEA_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={ideaType === type}
          onClick={() => onSelectType(ideaType === type ? null : type)}
          className={chipClass(ideaType === type)}
        >
          {IDEA_TYPE_STYLES[type].label} {counts[type]}
        </button>
      ))}
    </div>
  );
}
