import type { ReactElement } from "react";
import type { CustomerIdea } from "../../models/customerIdea";

interface IdeaDetailsProps {
  idea: CustomerIdea;
  /** How many other ideas, from anyone, are about the same order. */
  relatedCount: number;
  onShowOrder: () => void;
}

/** The expanded view of one idea: where it came from, and what else is being said about its order. */
export function IdeaDetails({ idea, relatedCount, onShowOrder }: IdeaDetailsProps): ReactElement {
  const rows: [string, string][] = [
    ["Idea", idea.idea_id],
    ["Status", idea.status],
    ["Persona version", String(idea.persona_version)],
    ["Model", idea.model_id],
    ["Prompt version", idea.prompt_version],
    ["Tokens", `${idea.input_tokens} in · ${idea.output_tokens} out`],
    ["Created", new Date(idea.created_at).toLocaleString()],
  ];
  if (idea.anchor) {
    rows.push(["311 complaint", `#${idea.anchor.external_unique_key}`], ["Order", idea.anchor.order_id]);
  }

  return (
    <div className="mt-3 rounded-lg border border-line-soft bg-panel-sunken p-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-subtle">{label}</dt>
            <dd className="break-all text-fg-muted">{value}</dd>
          </div>
        ))}
      </dl>
      {idea.anchor && (
        <button type="button" onClick={onShowOrder} className="mt-3 text-xs font-medium text-hue-blue hover:underline">
          {relatedCount > 0 ? `See all ${relatedCount + 1} ideas about this order` : "Show only this order"}
        </button>
      )}
    </div>
  );
}
