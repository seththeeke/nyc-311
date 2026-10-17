import type { ReactElement } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { useResidentPersonas } from "../../hooks/useResidentPersonas";
import { PersonaAvatar } from "./PersonaAvatar";
import { ResidentProfile } from "./ResidentProfile";
import { relativeTime } from "./residentFormat";
import { IDEA_DETAIL_PATTERN, residentFeedPath } from "./residentRoutes";

/**
 * The Idea Detail view's secondary workspace: the resident who had the
 * idea, in full. The panel sits outside the routed page, so it reads the
 * resident from the URL itself.
 */
export function ResidentDetailPanel(): ReactElement {
  const personaId = matchPath(IDEA_DETAIL_PATTERN, useLocation().pathname)?.params.personaId;
  const { data: personas, isLoading, error } = useResidentPersonas();
  const persona = personas?.find((candidate) => candidate.persona_id === personaId);

  return (
    <section aria-label="Resident details" className="px-3 pb-3">
      {isLoading && (
        <p role="status" className="text-xs text-fg-muted">
          Loading resident…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-2 text-xs text-danger">
          Couldn&apos;t load resident: {error.message}
        </p>
      )}
      {personas && !persona && <p className="text-xs text-fg-muted">This resident no longer exists.</p>}
      {persona && (
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-3 flex items-center gap-3">
            <PersonaAvatar name={persona.name} size="LG" />
            <div className="min-w-0">
              <h2 className="font-semibold text-fg">{persona.name}</h2>
              <p className="text-xs text-fg-muted">{persona.tagline}</p>
            </div>
          </div>
          <ResidentProfile persona={persona} compact />
          <p className="mt-3 text-xs text-fg-subtle">
            {persona.idea_count} ideas{persona.last_idea_at ? ` · last ${relativeTime(persona.last_idea_at)}` : ""}
          </p>
          <Link to={residentFeedPath(persona.persona_id)} className="mt-2 inline-block text-xs font-medium text-hue-blue hover:underline">
            See all of {persona.name}&apos;s ideas
          </Link>
        </div>
      )}
    </section>
  );
}
