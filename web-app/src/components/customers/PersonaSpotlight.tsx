import type { ReactElement } from "react";
import type { CustomerPersona } from "../../models/customerPersona";
import { DemeanorBars } from "./DemeanorBars";
import { PersonaAvatar } from "./PersonaAvatar";
import { activeHoursLabel, titleCase } from "./customerFormat";

interface PersonaSpotlightProps {
  persona: CustomerPersona;
  onClose: () => void;
}

/** The focused persona at the top of the feed: who they are, how they behave, and the prompt that voices them. */
export function PersonaSpotlight({ persona, onClose }: PersonaSpotlightProps): ReactElement {
  return (
    <section aria-label={`About ${persona.name}`} className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <PersonaAvatar personaId={persona.persona_id} name={persona.name} size="LG" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-fg">{persona.name}</h2>
          <p className="text-sm text-fg-muted">{persona.tagline}</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-fg-muted hover:text-fg">
          Show everyone
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg">{persona.backstory}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
    </section>
  );
}
