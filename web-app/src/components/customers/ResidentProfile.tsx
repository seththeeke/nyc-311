import type { ReactElement } from "react";
import type { CustomerPersona } from "../../models/customerPersona";
import { DemeanorBars } from "./DemeanorBars";
import { activeHoursLabel, titleCase } from "./customerFormat";

interface ResidentProfileProps {
  persona: CustomerPersona;
  /** Stack the dials above the facts, for the narrow secondary workspace. */
  compact?: boolean;
}

/** Everything about a resident below their name: backstory, every dial, when and where they are active, and their prompt. */
export function ResidentProfile({ persona, compact = false }: ResidentProfileProps): ReactElement {
  return (
    <>
      <p className="text-sm leading-relaxed text-fg">{persona.backstory}</p>
      <div className={`mt-4 grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        <DemeanorBars persona={persona} detailed />
        <dl className="space-y-1 text-xs">
          <div className="flex gap-2">
            <dt className="text-fg-subtle">Active</dt>
            <dd className="text-fg-muted">{activeHoursLabel(persona.active_hours)} New York time</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-fg-subtle">Follows</dt>
            <dd className="text-fg-muted">{persona.interests.boroughs.map(titleCase).join(", ") || "Anywhere"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-fg-subtle">Version</dt>
            <dd className="text-fg-muted">v{persona.version}</dd>
          </div>
        </dl>
      </div>
      <details className="mt-4 rounded-lg bg-panel-sunken p-3">
        <summary className="cursor-pointer text-xs font-medium text-fg-muted">Persona prompt</summary>
        <p className="mt-2 font-mono text-xs leading-relaxed text-fg-muted">{persona.persona_prompt}</p>
      </details>
    </>
  );
}
