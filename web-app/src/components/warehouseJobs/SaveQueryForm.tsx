import { useState, type FormEvent, type ReactElement } from "react";
import { WAREHOUSE_JOB_NAME_REGEX, type WarehouseJobDefinition } from "../../models/warehouseJobDefinition";

export interface SaveQueryFormProps {
  /** Pre-fills the form — the query console's "Save as query" control hands over the query text already in the console. */
  initialSql: string;
  onCreate: (name: string, sql: string) => Promise<WarehouseJobDefinition>;
  isCreating: boolean;
  error: Error | null;
  onCreated: (job: WarehouseJobDefinition) => void;
  onCancel: () => void;
}

/**
 * The save-a-query form (admin warehouse query-tabs enhancement) — a name
 * field and Save/Cancel, no cron builder: a saved query is a
 * `WarehouseJobDefinition` with `job_type: "SAVED_QUERY"` and no schedule,
 * unlike {@link JobDefinitionForm}'s scheduled-job counterpart.
 */
export function SaveQueryForm({ initialSql, onCreate, isCreating, error, onCreated, onCancel }: SaveQueryFormProps): ReactElement {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!WAREHOUSE_JOB_NAME_REGEX.test(trimmedName)) {
      setNameError("Lowercase letters, digits, and underscores only.");
      return;
    }
    setNameError(null);
    try {
      const job = await onCreate(trimmedName, initialSql);
      onCreated(job);
    } catch {
      /* error prop (from the caller's mutation state) already surfaces the failure below. */
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div>
        <label htmlFor="save-query-name" className="block text-sm font-medium text-slate-300">
          Query name
        </label>
        <input
          id="save-query-name"
          type="text"
          placeholder="e.g. top_zips_by_open_orders"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white"
        />
        {nameError && (
          <p role="alert" className="mt-1 text-sm text-red-400">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isCreating || name.trim() === ""}
          className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isCreating ? "Saving…" : "Save query"}
        </button>
        <button type="button" onClick={onCancel} className="rounded bg-white/10 px-4 py-2 text-slate-200">
          Cancel
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error.message}
        </p>
      )}
    </form>
  );
}
