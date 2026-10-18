import type { ReactElement } from "react";
import { useResidentPersonas } from "../../hooks/useResidentPersonas";
import { useResidentSelection } from "../../hooks/useResidentSelection";
import { PersonaCard } from "./PersonaCard";

/**
 * The Residents feed's secondary workspace: every resident, as cards.
 * Selecting one focuses the primary workspace's ideas on them; the
 * selection lives in the URL, so both panels stay in step.
 */
export function PersonaPanel(): ReactElement {
  const { data: personas, isLoading, error } = useResidentPersonas();
  const { personaId, selectPersona } = useResidentSelection();

  return (
    <section aria-label="Residents" className="flex flex-col gap-2 px-3 pb-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-fg">Residents</h2>
        {personaId && (
          <button type="button" onClick={() => selectPersona(null)} className="text-xs text-fg-muted hover:text-fg">
            Show everyone
          </button>
        )}
      </div>
      {isLoading && (
        <p role="status" className="text-xs text-fg-muted">
          Loading residents…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-2 text-xs text-danger">
          Couldn&apos;t load residents: {error.message}
        </p>
      )}
      {personas?.length === 0 && <p className="text-xs text-fg-muted">No residents yet.</p>}
      <ul className="space-y-2">
        {personas?.map((persona) => (
          <li key={persona.persona_id}>
            <PersonaCard
              persona={persona}
              selected={persona.persona_id === personaId}
              onSelect={() => selectPersona(persona.persona_id === personaId ? null : persona.persona_id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
