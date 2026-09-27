import type { ReactElement } from "react";
import { ENTITY_TYPES, type EntityType, type FeatureFlagOverride } from "../../models/featureFlag";

interface OverridesEditorProps {
  flagKey: string;
  overrides: FeatureFlagOverride[];
  treatments: string[];
  onChange: (overrides: FeatureFlagOverride[]) => void;
}

const FIELD_CLASSES = "rounded border border-line bg-panel px-2 py-1 text-sm text-fg";

/** Allow-list rows: pin a specific entity (today, an Operator) to one treatment regardless of the split. */
export function OverridesEditor({ flagKey, overrides, treatments, onChange }: OverridesEditorProps): ReactElement {
  const update = (index: number, patch: Partial<FeatureFlagOverride>): void =>
    onChange(overrides.map((override, i) => (i === index ? { ...override, ...patch } : override)));

  return (
    <fieldset>
      <legend className="text-sm font-medium text-fg-muted">Overrides (allow-list)</legend>
      {overrides.length === 0 && <p className="mt-1 text-sm text-fg-subtle">No overrides.</p>}
      <ul className="mt-2 space-y-2">
        {overrides.map((override, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`${flagKey} override ${index + 1} entity type`}
              value={override.entity_type}
              onChange={(e) => update(index, { entity_type: e.target.value as EntityType })}
              className={FIELD_CLASSES}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              aria-label={`${flagKey} override ${index + 1} entity id`}
              type="text"
              placeholder="operator_id"
              value={override.entity_id}
              onChange={(e) => update(index, { entity_id: e.target.value.trim() })}
              className={`${FIELD_CLASSES} w-56 font-mono`}
            />
            <span className="text-fg-subtle" aria-hidden="true">
              &rarr;
            </span>
            <select
              aria-label={`${flagKey} override ${index + 1} treatment`}
              value={override.treatment}
              onChange={(e) => update(index, { treatment: e.target.value })}
              className={FIELD_CLASSES}
            >
              {treatments.map((treatment) => (
                <option key={treatment} value={treatment}>
                  {treatment}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(overrides.filter((_, i) => i !== index))}
              aria-label={`Remove ${flagKey} override ${index + 1}`}
              className="rounded border border-line px-2 py-1 text-sm text-fg-muted hover:bg-panel-hover"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...overrides, { entity_type: "OPERATOR", entity_id: "", treatment: treatments[0] ?? "" }])}
        className="mt-2 rounded border border-line px-3 py-1 text-sm text-fg-muted hover:bg-panel-hover"
      >
        + Add override
      </button>
    </fieldset>
  );
}
