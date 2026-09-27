import type { ReactElement } from "react";
import type { FeatureFlagAllocation } from "../../models/featureFlag";
import { defaultShare } from "./featureFlagDraft";

interface AllocationsEditorProps {
  flagKey: string;
  allocations: FeatureFlagAllocation[];
  treatments: string[];
  defaultTreatment: string;
  onChange: (allocations: FeatureFlagAllocation[]) => void;
}

const FIELD_CLASSES = "rounded border border-line bg-panel px-2 py-1 text-sm text-fg";

/** The percentage split: each row sends that share of random traffic to a treatment; the remainder gets the default. */
export function AllocationsEditor({ flagKey, allocations, treatments, defaultTreatment, onChange }: AllocationsEditorProps): ReactElement {
  const update = (index: number, patch: Partial<FeatureFlagAllocation>): void =>
    onChange(allocations.map((allocation, i) => (i === index ? { ...allocation, ...patch } : allocation)));
  const remainder = defaultShare(allocations);

  return (
    <fieldset>
      <legend className="text-sm font-medium text-fg-muted">Percentage split</legend>
      <ul className="mt-2 space-y-2">
        {allocations.map((allocation, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`${flagKey} allocation ${index + 1} treatment`}
              value={allocation.treatment}
              onChange={(e) => update(index, { treatment: e.target.value })}
              className={FIELD_CLASSES}
            >
              {treatments.map((treatment) => (
                <option key={treatment} value={treatment}>
                  {treatment}
                </option>
              ))}
            </select>
            <input
              aria-label={`${flagKey} allocation ${index + 1} percent`}
              type="number"
              min={1}
              max={100}
              step={1}
              value={Number.isFinite(allocation.percent) ? allocation.percent : ""}
              onChange={(e) => update(index, { percent: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
              className={`${FIELD_CLASSES} w-20`}
            />
            <span className="text-sm text-fg-subtle">%</span>
            <button
              type="button"
              onClick={() => onChange(allocations.filter((_, i) => i !== index))}
              aria-label={`Remove ${flagKey} allocation ${index + 1}`}
              className="rounded border border-line px-2 py-1 text-sm text-fg-muted hover:bg-panel-hover"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className={`mt-2 text-sm ${remainder < 0 ? "text-danger" : "text-fg-subtle"}`}>
        Default ({defaultTreatment || "unset"}) gets {remainder}%
      </p>
      <button
        type="button"
        onClick={() => onChange([...allocations, { treatment: treatments[0] ?? "", percent: 10 }])}
        className="mt-2 rounded border border-line px-3 py-1 text-sm text-fg-muted hover:bg-panel-hover"
      >
        + Add split
      </button>
    </fieldset>
  );
}
