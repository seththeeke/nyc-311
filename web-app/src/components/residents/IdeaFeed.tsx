import type { ReactElement } from "react";
import { useResidentIdeas } from "../../hooks/useResidentIdeas";
import { useResidentPersonas } from "../../hooks/useResidentPersonas";
import { useResidentSelection } from "../../hooks/useResidentSelection";
import { IDEA_TYPES, type ResidentIdea, type IdeaType } from "../../models/residentIdea";
import { IdeaCard } from "./IdeaCard";
import { IdeaFilters } from "./IdeaFilters";
import { PersonaSpotlight } from "./PersonaSpotlight";

/* Nothing at all is not the same as nothing matching a filter. */
function emptyMessage(hasAny: boolean, personaName: string | undefined): string {
  if (hasAny) return "No ideas match what's selected.";
  if (personaName) return `${personaName} hasn't had an idea yet.`;
  return "No ideas yet. Residents think about ideas on their own schedule, and not every thought becomes one.";
}

function countByType(ideas: ResidentIdea[]): Record<IdeaType, number> {
  const counts = Object.fromEntries(IDEA_TYPES.map((type) => [type, 0])) as Record<IdeaType, number>;
  for (const idea of ideas) counts[idea.idea_type] += 1;
  return counts;
}

/**
 * The Residents page's primary workspace: every idea, newest first,
 * narrowed by whatever is selected — a resident (from either workspace),
 * an order, or an idea type.
 */
export function IdeaFeed(): ReactElement {
  const selection = useResidentSelection();
  const { data: ideas, isLoading, error, hasMore, loadMore, isLoadingMore } = useResidentIdeas(selection.personaId);
  const { data: personas } = useResidentPersonas();
  const persona = personas?.find((candidate) => candidate.persona_id === selection.personaId);

  const inScope = (ideas ?? []).filter((idea) => !selection.orderId || idea.anchor?.order_id === selection.orderId);
  const shown = inScope.filter((idea) => !selection.ideaType || idea.idea_type === selection.ideaType);
  const orderAnchor = inScope.find((idea) => idea.anchor)?.anchor;

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
      {hasMore && ideas && <p className="text-xs text-fg-subtle">Counts cover the {ideas.length} newest ideas loaded so far.</p>}
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
      {ideas && shown.length === 0 && <p className="text-sm text-fg-muted">{emptyMessage(ideas.length > 0, persona?.name)}</p>}
      <ul className="space-y-3">
        {shown.map((idea) => (
          <li key={idea.idea_id}>
            <IdeaCard
              idea={idea}
              persona={personas?.find((candidate) => candidate.persona_id === idea.persona_id)}
              onSelectPersona={() => selection.selectPersona(idea.persona_id)}
              onSelectOrder={() => selection.selectOrder(idea.anchor?.order_id ?? null)}
            />
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-fg-muted hover:bg-panel-hover hover:text-fg disabled:opacity-60"
        >
          {isLoadingMore ? "Loading older ideas…" : "Load older ideas"}
        </button>
      )}
    </div>
  );
}
