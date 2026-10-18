import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useResidentIdeas } from "../../hooks/useResidentIdeas";
import type { ResidentIdea } from "../../models/residentIdea";
import { relativeTime } from "./residentFormat";
import { ideaDetailPath } from "./residentRoutes";

/** Every other idea, from any resident, about the same order — each a link to its own detail view. */
export function RelatedIdeas({ idea }: { idea: ResidentIdea }): ReactElement | null {
  const { data: ideas } = useResidentIdeas(null);
  const orderId = idea.anchor?.order_id;
  if (!orderId) return null;
  const related = (ideas ?? []).filter((other) => other.idea_id !== idea.idea_id && other.anchor?.order_id === orderId);

  return (
    <section aria-label="Other ideas about this order" className="mt-6">
      <h2 className="text-sm font-semibold text-fg">Other ideas about this order</h2>
      {related.length === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">None yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {related.map((other) => (
            <li key={other.idea_id}>
              <Link
                to={ideaDetailPath(other.persona_id, other.idea_id)}
                className="block rounded-lg border border-line bg-panel px-3 py-2 text-sm text-fg-muted hover:bg-panel-hover hover:text-fg"
              >
                <span className="text-xs text-fg-subtle">{relativeTime(other.created_at)} · </span>
                {other.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
