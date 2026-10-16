import type { ReactElement } from "react";
import type { CustomerPersona } from "../../models/customerPersona";
import { DemeanorBars } from "./DemeanorBars";
import { PersonaAvatar } from "./PersonaAvatar";
import { activeHoursLabel, relativeTime } from "./customerFormat";

interface PersonaCardProps {
  persona: CustomerPersona;
  selected: boolean;
  onSelect: () => void;
}

/** One resident in the secondary workspace. Pressing it focuses the ideas feed on them; pressing again clears it. */
export function PersonaCard({ persona, selected, onSelect }: PersonaCardProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-400 ${
        selected ? "border-blue-500/60 bg-blue-600/10" : "border-line bg-panel hover:bg-panel-hover"
      }`}
    >
      <div className="flex items-start gap-3">
        <PersonaAvatar name={persona.name} />
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-fg">{persona.name}</span>
          <p className="mt-0.5 text-xs text-fg-muted">{persona.tagline}</p>
        </div>
      </div>
      <div className="mt-3">
        <DemeanorBars persona={persona} />
      </div>
      <p className="mt-2 flex justify-between text-[11px] text-fg-subtle">
        <span>
          {persona.idea_count} ideas{persona.last_idea_at ? ` · last ${relativeTime(persona.last_idea_at)}` : ""}
        </span>
        <span>{activeHoursLabel(persona.active_hours)}</span>
      </p>
    </button>
  );
}
