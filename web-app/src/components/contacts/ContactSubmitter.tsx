import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useResidentPersonas } from "../../hooks/useResidentPersonas";
import { PersonaAvatar } from "../residents/PersonaAvatar";
import { residentFeedPath } from "../residents/residentRoutes";

/** Who sent the contact: their face and tagline, linked to their ideas, when the name matches a resident; just the name otherwise. */
export function ContactSubmitter({ name }: { name: string }): ReactElement {
  const { data: personas } = useResidentPersonas();
  const persona = personas?.find((candidate) => candidate.name === name);
  return (
    <div className="flex items-center gap-3">
      <PersonaAvatar name={name} modelKey={persona?.model_key ?? null} size="LG" />
      <div className="min-w-0">
        <p className="font-semibold text-fg">{name}</p>
        {persona && (
          <>
            <p className="text-xs text-fg-muted">{persona.tagline}</p>
            <Link to={residentFeedPath(persona.persona_id)} className="text-xs font-medium text-hue-blue hover:underline">
              See {persona.name}&apos;s ideas
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
