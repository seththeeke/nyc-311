import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import type { ResidentIdea } from "../../models/residentIdea";
import type { ResidentPersona } from "../../models/residentPersona";
import { IdeaActionTag } from "./IdeaActionTag";
import { PersonaAvatar } from "./PersonaAvatar";
import { relativeTime, titleCase } from "./residentFormat";
import { ideaDetailPath } from "./residentRoutes";

interface IdeaCardProps {
  idea: ResidentIdea;
  persona: ResidentPersona | undefined;
  onSelectPersona: () => void;
  onSelectOrder: () => void;
}

/** One idea in the feed: who had it, what they want, the order it is about, and what they did. Every part is a way further in. */
export function IdeaCard({ idea, persona, onSelectPersona, onSelectOrder }: IdeaCardProps): ReactElement {
  const name = persona?.name ?? idea.persona_id;
  const anchor = idea.anchor;
  return (
    <article aria-label={`${name}: ${idea.text}`} className="rounded-xl border border-line bg-panel p-4">
      <header className="flex items-center gap-2">
        <button type="button" onClick={onSelectPersona} className="flex items-center gap-2 rounded-lg font-semibold text-fg hover:underline">
          <PersonaAvatar name={name} modelKey={persona?.model_key} />
          {name}
        </button>
        <time dateTime={idea.created_at} className="ml-auto text-xs text-fg-subtle">
          {relativeTime(idea.created_at)}
        </time>
      </header>
      <p className="mt-2 text-sm leading-relaxed text-fg">{idea.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {anchor ? (
          <button type="button" onClick={onSelectOrder} className="rounded-full bg-panel-strong px-2.5 py-1 text-xs text-fg-muted hover:text-fg">
            {anchor.descriptor ?? "Order"} · {anchor.address ?? "address unknown"}
            {anchor.borough ? `, ${titleCase(anchor.borough)}` : ""}
          </button>
        ) : (
          <span className="text-xs text-fg-subtle">About the service, not an order</span>
        )}
        {idea.actions.length > 0 ? (
          idea.actions.map((action, i) => <IdeaActionTag key={`${action.type}-${i}`} action={action} />)
        ) : (
          <IdeaActionTag action={null} />
        )}
        <Link to={ideaDetailPath(idea.persona_id, idea.idea_id)} className="ml-auto text-xs font-medium text-fg-muted hover:text-fg">
          View details
        </Link>
      </div>
    </article>
  );
}
