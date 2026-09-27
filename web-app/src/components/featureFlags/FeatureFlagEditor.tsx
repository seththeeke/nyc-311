import { useState, type ReactElement } from "react";
import type { CreateFeatureFlagRequest, FeatureFlag, UpdateFeatureFlagRequest } from "../../models/featureFlag";
import { AllocationsEditor } from "./AllocationsEditor";
import { OverridesEditor } from "./OverridesEditor";
import { draftIssues, draftToInput, emptyDraft, parseTreatments, toDraft, type FeatureFlagDraft } from "./featureFlagDraft";

interface FeatureFlagEditorProps {
  /** Omitted for a brand-new flag. */
  flag?: FeatureFlag;
  onCreate: (request: CreateFeatureFlagRequest) => Promise<unknown>;
  onUpdate: (flagKey: string, request: UpdateFeatureFlagRequest) => Promise<unknown>;
  onDelete: (flagKey: string) => Promise<unknown>;
  onClose: () => void;
}

const FIELD_CLASSES = "mt-1 w-full rounded border border-line bg-panel px-3 py-2 text-sm text-fg";

/** In-place editor for one flag (§4 Q7). Save sends the whole config with the version it was loaded at (§4 Q5). */
export function FeatureFlagEditor({ flag, onCreate, onUpdate, onDelete, onClose }: FeatureFlagEditorProps): ReactElement {
  const isNew = flag === undefined;
  const [draft, setDraft] = useState<FeatureFlagDraft>(() => (flag ? toDraft(flag) : emptyDraft()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const idPrefix = `feature-flag-${flag?.flag_key ?? "new"}`;
  const label = flag?.flag_key ?? "new flag";
  const treatments = parseTreatments(draft.treatmentsText);
  const issues = draftIssues(draft, isNew);
  const patch = (changes: Partial<FeatureFlagDraft>): void => setDraft((current) => ({ ...current, ...changes }));

  async function run(action: () => Promise<unknown>, closeAfter: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (closeAfter) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const save = (): Promise<void> =>
    flag
      ? run(() => onUpdate(flag.flag_key, { ...draftToInput(draft), expected_version: flag.version }), false)
      : run(() => onCreate({ ...draftToInput(draft), flag_key: draft.flag_key }), true);

  return (
    <div className="space-y-4 border-t border-line-soft px-4 py-4">
      {isNew && (
        <div>
          <label htmlFor={`${idPrefix}-key`} className="block text-sm font-medium text-fg-muted">
            Flag key
          </label>
          <input id={`${idPrefix}-key`} type="text" placeholder="MY_FLAG" value={draft.flag_key}
            onChange={(e) => patch({ flag_key: e.target.value.toUpperCase() })} className={`${FIELD_CLASSES} font-mono`} />
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-description`} className="block text-sm font-medium text-fg-muted">
          Description
        </label>
        <input id={`${idPrefix}-description`} type="text" value={draft.description}
          onChange={(e) => patch({ description: e.target.value })} className={FIELD_CLASSES} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-treatments`} className="block text-sm font-medium text-fg-muted">
            Treatments (comma-separated)
          </label>
          <input id={`${idPrefix}-treatments`} type="text" value={draft.treatmentsText}
            onChange={(e) => patch({ treatmentsText: e.target.value.toUpperCase() })} className={`${FIELD_CLASSES} font-mono`} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-default`} className="block text-sm font-medium text-fg-muted">
            Default treatment
          </label>
          <select id={`${idPrefix}-default`} value={draft.default_treatment}
            onChange={(e) => patch({ default_treatment: e.target.value })} className={FIELD_CLASSES}>
            {!treatments.includes(draft.default_treatment) && <option value={draft.default_treatment}>Pick one…</option>}
            {treatments.map((treatment) => (
              <option key={treatment} value={treatment}>
                {treatment}
              </option>
            ))}
          </select>
        </div>
      </div>
      <OverridesEditor flagKey={label} overrides={draft.overrides} treatments={treatments} onChange={(overrides) => patch({ overrides })} />
      <AllocationsEditor flagKey={label} allocations={draft.allocations} treatments={treatments}
        defaultTreatment={draft.default_treatment} onChange={(allocations) => patch({ allocations })} />
      {issues.length > 0 && (
        <ul aria-label={`${label} validation problems`} className="list-disc pl-5 text-sm text-hue-amber">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || issues.length > 0}
          className="rounded bg-emerald-600 px-4 py-2 text-sm text-on-accent disabled:opacity-50">
          {busy ? "Saving…" : isNew ? "Create flag" : "Save"}
        </button>
        <button type="button" onClick={onClose} disabled={busy}
          className="rounded border border-line px-4 py-2 text-sm text-fg-muted hover:bg-panel-hover disabled:opacity-50">
          {isNew ? "Discard" : "Close"}
        </button>
        {flag && !confirmingDelete && (
          <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy}
            className="ml-auto rounded bg-rose-600/80 px-4 py-2 text-sm text-fg disabled:opacity-50">
            Delete
          </button>
        )}
        {flag && confirmingDelete && (
          <button type="button" onClick={() => void run(() => onDelete(flag.flag_key), true)} disabled={busy}
            className="ml-auto rounded bg-rose-600 px-4 py-2 text-sm text-fg disabled:opacity-50">
            Confirm delete {flag.flag_key}
          </button>
        )}
      </div>
    </div>
  );
}
