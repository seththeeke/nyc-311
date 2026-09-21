import { useState, type ReactElement } from "react";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import { DeleteIcon, LoadIcon } from "../icons";

export interface SavedQueriesListProps {
  queries: WarehouseJobDefinition[];
  onDelete: (name: string) => Promise<void>;
  isDeleting: boolean;
  deleteError: Error | null;
  onLoad: (query: WarehouseJobDefinition) => void;
  loadingName: string | null;
}

const ICON_BUTTON =
  "rounded p-1.5 text-fg-subtle transition-transform transition-colors hover:scale-110 hover:text-fg disabled:opacity-50 disabled:hover:scale-100";

/**
 * The Schema panel's "Saved queries" view (admin warehouse query-tabs
 * enhancement) — condensed rows (name + saved date, Load/Delete icons),
 * same treatment as {@link JobDefinitionList} minus the History icon
 * (a saved query has no run history — it's never executed on its own).
 */
export function SavedQueriesList({ queries, onDelete, isDeleting, deleteError, onLoad, loadingName }: SavedQueriesListProps): ReactElement {
  const [confirmingName, setConfirmingName] = useState<string | null>(null);

  async function handleConfirmDelete(name: string): Promise<void> {
    try {
      await onDelete(name);
    } catch {
      /* deleteError already surfaces the failure below. */
    } finally {
      setConfirmingName(null);
    }
  }

  if (queries.length === 0) {
    return <p className="text-sm text-fg-subtle">No saved queries yet — save one from the query console.</p>;
  }

  return (
    <div className="space-y-2">
      {deleteError && (
        <p role="alert" className="text-sm text-danger">
          {deleteError.message}
        </p>
      )}
      <ul className="space-y-1">
        {queries.map((query) => (
          <li key={query.job_name} className="rounded-lg border border-line">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-fg">{query.job_name}</p>
                <p className="truncate text-xs text-fg-subtle">Saved {new Date(query.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onLoad(query)}
                  disabled={loadingName === query.job_name}
                  aria-label={loadingName === query.job_name ? `Loading ${query.job_name}` : `Load query ${query.job_name}`}
                  title="Load into a new query tab"
                  className={ICON_BUTTON}
                >
                  <LoadIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingName(query.job_name)}
                  aria-label={`Delete query ${query.job_name}`}
                  title="Delete"
                  className={`${ICON_BUTTON} hover:text-hue-rose`}
                >
                  <DeleteIcon />
                </button>
              </div>
            </div>
            {confirmingName === query.job_name && (
              <div className="flex items-center gap-2 border-t border-line bg-panel-sunken px-3 py-2 text-xs">
                <span className="text-hue-amber">Delete {query.job_name}?</span>
                <button
                  type="button"
                  onClick={() => void handleConfirmDelete(query.job_name)}
                  disabled={isDeleting}
                  className="rounded bg-rose-600 px-2 py-1 text-on-accent disabled:opacity-50"
                >
                  {isDeleting ? "Deleting…" : "Confirm"}
                </button>
                <button type="button" onClick={() => setConfirmingName(null)} className="rounded bg-panel-hover px-2 py-1 text-fg-muted">
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
