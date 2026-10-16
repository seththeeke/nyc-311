import type { ReactElement } from "react";
import type { CustomerPersona } from "../../models/customerPersona";
import { PersonaAvatar } from "./PersonaAvatar";
import { ResidentProfile } from "./ResidentProfile";

interface PersonaSpotlightProps {
  persona: CustomerPersona;
  onClose: () => void;
}

/** The focused resident at the top of the feed. */
export function PersonaSpotlight({ persona, onClose }: PersonaSpotlightProps): ReactElement {
  return (
    <section aria-label={`About ${persona.name}`} className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-start gap-3">
        <PersonaAvatar name={persona.name} size="LG" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-fg">{persona.name}</h2>
          <p className="text-sm text-fg-muted">{persona.tagline}</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-fg-muted hover:text-fg">
          Show everyone
        </button>
      </div>
      <ResidentProfile persona={persona} />
    </section>
  );
}
