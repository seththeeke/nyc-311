import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { useResidentIdea } from "../../hooks/useResidentIdea";
import { useResidentPersonas } from "../../hooks/useResidentPersonas";
import { IdeaActionDetail } from "../residents/IdeaActionDetail";
import { PersonaAvatar } from "../residents/PersonaAvatar";
import { RelatedIdeas } from "../residents/RelatedIdeas";
import { IDEA_TYPE_LABELS, titleCase } from "../residents/residentFormat";
import { RESIDENTS_PATH, residentFeedPath } from "../residents/residentRoutes";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

function Facts({ title, rows }: { title: string; rows: [string, string][] }): ReactElement {
  return (
    <section aria-label={title} className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-2 text-sm font-semibold text-fg">{title}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-subtle">{label}</dt>
            <dd className="break-all text-fg-muted">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The Idea Detail view: one idea in full in the primary workspace — what
 * the resident did about it, the order it is about and how it was generated. The secondary workspace
 * shows the resident who had it (`ResidentDetailPanel`).
 */
export function ResidentIdeaPage(): ReactElement {
  const { personaId = "", ideaId = "" } = useParams();
  const { data: idea, isLoading, error } = useResidentIdea(personaId, ideaId);
  const persona = useResidentPersonas().data?.find((candidate) => candidate.persona_id === personaId);
  const name = persona?.name ?? personaId;

  return (
    <main className={PAGE_CONTENT_CLASSES}>
      <Link to={RESIDENTS_PATH} className="text-sm text-fg-muted hover:text-fg">
        ← All ideas
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-fg">Idea Detail</h1>
      {isLoading && (
        <p role="status" className="mt-4 text-sm text-fg-muted">
          Loading idea…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">
          Couldn&apos;t load this idea: {error.message}
        </p>
      )}
      {idea && (
        <>
          <div className="mt-4 flex items-center gap-2">
            <PersonaAvatar name={name} />
            <Link to={residentFeedPath(personaId)} className="font-semibold text-fg hover:underline">
              {name}
            </Link>
            <span className="text-sm text-fg-subtle">· {IDEA_TYPE_LABELS[idea.idea_type]}</span>
            <time dateTime={idea.created_at} className="ml-auto text-sm text-fg-subtle">
              {new Date(idea.created_at).toLocaleString()}
            </time>
          </div>
          <blockquote className="mt-3 rounded-xl border border-line bg-panel p-4 text-base leading-relaxed text-fg">{idea.text}</blockquote>
          <IdeaActionDetail actions={idea.actions} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {idea.anchor ? (
              <Facts
                title="The order"
                rows={[
                  ["Problem", idea.anchor.descriptor ?? "Unknown"],
                  ["Address", idea.anchor.address ?? "Unknown"],
                  ["Borough", idea.anchor.borough ? titleCase(idea.anchor.borough) : "Unknown"],
                  ["311 complaint", `#${idea.anchor.external_unique_key}`],
                  ["Order", idea.anchor.order_id],
                ]}
              />
            ) : (
              <Facts title="The order" rows={[["About", "The service itself, not an order"]]} />
            )}
            <Facts
              title="How it was generated"
              rows={[
                ["Model", idea.model_id],
                ["Prompt version", idea.prompt_version],
                ["Tokens", `${idea.input_tokens} in · ${idea.output_tokens} out`],
                ["Resident version", `v${idea.persona_version}`],
                ["Idea", idea.idea_id],
              ]}
            />
          </div>
          <RelatedIdeas idea={idea} />
        </>
      )}
    </main>
  );
}
