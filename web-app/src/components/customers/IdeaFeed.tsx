import type { ReactElement } from "react";
import { useCustomerIdeas } from "../../hooks/useCustomerIdeas";
import { useCustomerPersonas } from "../../hooks/useCustomerPersonas";
import { useCustomerSelection } from "../../hooks/useCustomerSelection";
import { IDEA_TYPES, type CustomerIdea, type IdeaType } from "../../models/customerIdea";
import { IdeaCard } from "./IdeaCard";
import { IdeaFilters } from "./IdeaFilters";
import { PersonaSpotlight } from "./PersonaSpotlight";

function countByType(ideas: CustomerIdea[]): Record<IdeaType, number> {
  const counts = Object.fromEntries(IDEA_TYPES.map((type) => [type, 0])) as Record<IdeaType, number>;
  for (const idea of ideas) counts[idea.idea_type] += 1;
  return counts;
}

/**
 * The Customers page's primary workspace: every idea, newest first,
 * narrowed by whatever is selected — a persona (from either workspace), an
 * order, or an idea type.
 */
export function IdeaFeed(): ReactElement {
  const selection = useCustomerSelection();
  const { data: ideas, isLoading, error } = useCustomerIdeas(selection.personaId);
  const { data: personas } = useCustomerPersonas();
  const persona = personas?.find((candidate) => candidate.persona_id === selection.personaId);

  const inScope = (ideas ?? []).filter((idea) => !selection.orderId || idea.anchor?.order_id === selection.orderId);
  const shown = inScope.filter((idea) => !selection.ideaType || idea.idea_type === selection.ideaType);
  const orderAnchor = inScope.find((idea) => idea.anchor)?.anchor;
  const relatedCount = (idea: CustomerIdea): number =>
    (ideas ?? []).filter((other) => other.idea_id !== idea.idea_id && idea.anchor && other.anchor?.order_id === idea.anchor.order_id).length;

  return (
    <div className="space-y-4">
      {persona && <PersonaSpotlight persona={persona} onClose={() => selection.selectPersona(null)} />}
      {selection.orderId && (
        <div className="flex items-center gap-3 rounded-lg bg-panel-strong px-3 py-2 text-sm text-fg">
          <span>
            Ideas about {orderAnchor ? `${orderAnchor.descriptor ?? "order"} at ${orderAnchor.address ?? "an unknown address"}` : "one order"}
          </span>
          <button type="button" onClick={() => selection.selectOrder(null)} className="ml-auto text-xs text-fg-muted hover:text-fg">
            Clear
          </button>
        </div>
      )}
      <IdeaFilters ideaType={selection.ideaType} counts={countByType(inScope)} total={inScope.length} onSelectType={selection.selectIdeaType} />
      {isLoading && (
        <p role="status" className="text-sm text-fg-muted">
          Loading ideas…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          Couldn&apos;t load ideas: {error.message}
        </p>
      )}
      {ideas && shown.length === 0 && <p className="text-sm text-fg-muted">No ideas match what&apos;s selected.</p>}
      <ul className="space-y-3">
        {shown.map((idea) => (
          <li key={idea.idea_id}>
            <IdeaCard
              idea={idea}
              persona={personas?.find((candidate) => candidate.persona_id === idea.persona_id)}
              expanded={selection.ideaId === idea.idea_id}
              relatedCount={relatedCount(idea)}
              onToggle={() => selection.toggleIdea(idea.idea_id)}
              onSelectPersona={() => selection.selectPersona(idea.persona_id)}
              onSelectOrder={() => selection.selectOrder(idea.anchor?.order_id ?? null)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
