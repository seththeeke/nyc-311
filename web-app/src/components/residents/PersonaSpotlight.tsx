import { lazy, type ReactElement, Suspense } from "react";
import type { ResidentPersona } from "../../models/residentPersona";
import { isWebGlAvailable } from "../three/webgl";
import { PersonaAvatar } from "./PersonaAvatar";
import { ResidentProfile } from "./ResidentProfile";

/* Three.js arrives with the stage, not with the page. */
const ResidentStage = lazy(() => import("./ResidentStage"));

interface PersonaSpotlightProps {
  persona: ResidentPersona;
  onClose: () => void;
}

/**
 * The focused resident at the top of the feed — their profile, with the
 * resident themselves standing beside it, waving (a Mii-style full-body
 * view). Without a model or WebGL, the large avatar stands in.
 */
export function PersonaSpotlight({ persona, onClose }: PersonaSpotlightProps): ReactElement {
  const showStage = persona.model_key !== null && isWebGlAvailable();
  return (
    <section aria-label={`About ${persona.name}`} className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-start gap-3">
        {!showStage && <PersonaAvatar name={persona.name} modelKey={persona.model_key} size="LG" />}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-fg">{persona.name}</h2>
          <p className="text-sm text-fg-muted">{persona.tagline}</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-fg-muted hover:text-fg">
          Show everyone
        </button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {showStage && persona.model_key && (
          <div className="flex justify-center rounded-xl bg-panel-sunken sm:shrink-0">
            <Suspense fallback={<div role="status" aria-label={`Loading ${persona.name}`} className="h-64 w-48" />}>
              <ResidentStage name={persona.name} modelKey={persona.model_key} />
            </Suspense>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <ResidentProfile persona={persona} />
        </div>
      </div>
    </section>
  );
}
