import type { ReactElement } from "react";
import type { CreateFeatureFlagRequest, FeatureFlag, UpdateFeatureFlagRequest } from "../../models/featureFlag";
import { FeatureFlagEditor } from "./FeatureFlagEditor";
import { summarizeAllocations } from "./featureFlagDraft";

interface FeatureFlagRowProps {
  flag: FeatureFlag;
  expanded: boolean;
  onToggle: () => void;
  onCreate: (request: CreateFeatureFlagRequest) => Promise<unknown>;
  onUpdate: (flagKey: string, request: UpdateFeatureFlagRequest) => Promise<unknown>;
  onDelete: (flagKey: string) => Promise<unknown>;
}

/** One flag's summary line, expanding in place into its editor (§4 Q7). */
export function FeatureFlagRow({ flag, expanded, onToggle, onCreate, onUpdate, onDelete }: FeatureFlagRowProps): ReactElement {
  const editorId = `feature-flag-editor-${flag.flag_key}`;

  return (
    <li className="glass rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={editorId}
        className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-left text-sm hover:bg-panel-hover"
      >
        <span aria-hidden="true" className="text-fg-subtle">
          {expanded ? "▾" : "▸"}
        </span>
        <span className="font-mono font-semibold text-fg">{flag.flag_key}</span>
        <span className="text-fg-muted">default {flag.default_treatment}</span>
        <span className="text-fg-muted">
          {flag.overrides.length} override{flag.overrides.length === 1 ? "" : "s"}
        </span>
        <span className="text-fg-muted">split {summarizeAllocations(flag.allocations)}</span>
        <span className="ml-auto text-xs text-fg-subtle">v{flag.version}</span>
      </button>
      {expanded && (
        <div id={editorId}>
          {/* Keyed by version so a successful save (new version) reloads the editor from the saved flag. */}
          <FeatureFlagEditor
            key={flag.version}
            flag={flag}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onClose={onToggle}
          />
        </div>
      )}
    </li>
  );
}
