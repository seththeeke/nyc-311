import type { ReactElement } from "react";
import type { CustomerIdea } from "../../models/customerIdea";
import type { CustomerPersona } from "../../models/customerPersona";
import { IdeaDetails } from "./IdeaDetails";
import { IdeaTypeBadge } from "./IdeaTypeBadge";
import { PersonaAvatar } from "./PersonaAvatar";
import { relativeTime, titleCase } from "./customerFormat";

interface IdeaCardProps {
  idea: CustomerIdea;
  persona: CustomerPersona | undefined;
  expanded: boolean;
  relatedCount: number;
  onToggle: () => void;
  onSelectPersona: () => void;
  onSelectOrder: () => void;
}

/** One idea in the feed: who had it, what they want, and the order it is about. Every part is a way further in. */
export function IdeaCard({ idea, persona, expanded, relatedCount, onToggle, onSelectPersona, onSelectOrder }: IdeaCardProps): ReactElement {
  const name = persona?.name ?? idea.persona_id;
  const anchor = idea.anchor;
  return (
    <article aria-label={`${name}: ${idea.text}`} className="rounded-xl border border-line bg-panel p-4">
      <header className="flex items-center gap-2">
        <button type="button" onClick={onSelectPersona} className="flex items-center gap-2 rounded-lg font-semibold text-fg hover:underline">
          <PersonaAvatar personaId={idea.persona_id} name={name} />
          {name}
        </button>
        <IdeaTypeBadge type={idea.idea_type} />
        <time dateTime={idea.created_at} className="ml-auto text-xs text-fg-subtle">
          {relativeTime(idea.created_at)}
        </time>
      </header>
      <p className="mt-2 text-sm leading-relaxed text-fg">{idea.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {anchor ? (
          <button
            type="button"
            onClick={onSelectOrder}
            className="rounded-full bg-panel-strong px-2.5 py-1 text-xs text-fg-muted hover:text-fg"
          >
            {anchor.descriptor ?? "Order"} · {anchor.address ?? "address unknown"}
            {anchor.borough ? `, ${titleCase(anchor.borough)}` : ""}
          </button>
        ) : (
          <span className="text-xs text-fg-subtle">About the service, not an order</span>
        )}
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="ml-auto text-xs text-fg-muted hover:text-fg">
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>
      {expanded && <IdeaDetails idea={idea} relatedCount={relatedCount} onShowOrder={onSelectOrder} />}
    </article>
  );
}
