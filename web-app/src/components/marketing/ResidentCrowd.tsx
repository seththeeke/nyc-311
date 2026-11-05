import type { ReactElement } from "react";
import type { ResidentIdea } from "../../models/residentIdea";
import type { ResidentPersona } from "../../models/residentPersona";
import { PersonaAvatar } from "../residents/PersonaAvatar";
import { useTicker } from "./useTicker";

const IDEA_MS = 4500;
const MAX_IDEAS = 8;

interface ResidentCrowdProps {
  personas: readonly ResidentPersona[];
  ideas: readonly ResidentIdea[];
  playing: boolean;
}

/*
 * The residents themselves: a floating crowd of avatars, gently bobbing out of
 * step, and a speech bubble cycling through their latest real ideas, with the
 * speaker's avatar lifted and ringed.
 */
export function ResidentCrowd({ personas, ideas, playing }: ResidentCrowdProps): ReactElement {
  const tick = useTicker(IDEA_MS, playing);
  const recent = ideas.slice(0, MAX_IDEAS);
  const idea = recent.length > 0 ? recent[tick % recent.length] : null;
  const speaker = idea ? personas.find((p) => p.persona_id === idea.persona_id) ?? null : null;
  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        {personas.map((persona, i) => {
          const speaking = persona.persona_id === speaker?.persona_id;
          return (
            <li
              key={persona.persona_id}
              title={persona.tagline}
              className="flex animate-[mk-bob_5s_ease-in-out_infinite] flex-col items-center gap-2 text-center"
              style={{ animationDelay: `${-i * 0.7}s` }}
            >
              <span className={`rounded-full p-1 transition-all duration-500 ${speaking ? "scale-110 bg-hue-rose shadow-[0_0_30px_var(--t-hue-rose)]" : "bg-transparent"}`}>
                <PersonaAvatar name={persona.name} modelKey={persona.model_key} size="XL" />
              </span>
              <span className={`text-sm font-bold ${speaking ? "text-hue-rose" : "text-fg"}`}>{persona.name}</span>
            </li>
          );
        })}
      </ul>
      {idea && (
        <figure key={idea.idea_id} className="glass relative animate-[mk-rise_0.6s_ease-out_both] rounded-3xl p-6">
          <span aria-hidden="true" className="absolute -top-2 left-10 h-4 w-4 rotate-45 border-l border-t border-line bg-panel" />
          <blockquote className="text-lg leading-relaxed text-fg">&ldquo;{idea.text}&rdquo;</blockquote>
          <figcaption className="mt-3 text-sm text-fg-subtle">
            {speaker ? <span className="font-bold text-hue-rose">{speaker.name}</span> : "A resident"}
            {speaker ? `, ${speaker.tagline.charAt(0).toLowerCase()}${speaker.tagline.slice(1)}` : ""}
          </figcaption>
        </figure>
      )}
    </div>
  );
}
