import { useState, type FormEvent, type ReactElement } from "react";
import { WAREHOUSE_JOB_NAME_REGEX, type WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import { DEFAULT_CRON_PRESET, buildCronExpression } from "../../models/cronSchedule";
import { CronScheduleBuilder } from "../query/CronScheduleBuilder";

export interface JobDefinitionFormProps {
  /** Pre-fills the SQL textarea — the Query tab's "Save as job" control hands over the query text already in the console. */
  initialSql?: string;
  onCreate: (name: string, sql: string, cadenceCron: string) => Promise<WarehouseJobDefinition>;
  isCreating: boolean;
  error: Error | null;
  onCreated: (job: WarehouseJobDefinition) => void;
  onCancel: () => void;
}

/**
 * The create-job form (7-data-warehousing.md §12b, Leg 8) — backs both
 * the Jobs tab's "New job" button (empty) and the Query tab's "Save as
 * job" control (pre-filled). Name uniqueness/collision (409) surfaces
 * through the `error` prop, same as every other mutation error in this
 * app — not re-validated client-side beyond the regex shape.
 */
export function JobDefinitionForm({
  initialSql,
  onCreate,
  isCreating,
  error,
  onCreated,
  onCancel,
}: JobDefinitionFormProps): ReactElement {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [sql, setSql] = useState(initialSql ?? "");
  const [cadenceCron, setCadenceCron] = useState(buildCronExpression(DEFAULT_CRON_PRESET));

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!WAREHOUSE_JOB_NAME_REGEX.test(trimmedName)) {
      setNameError("Lowercase letters, digits, and underscores only.");
      return;
    }
    setNameError(null);
    try {
      const job = await onCreate(trimmedName, sql, cadenceCron);
      onCreated(job);
    } catch {
      /* error prop (from the caller's mutation state) already surfaces the failure below. */
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div>
        <label htmlFor="job-definition-name" className="block text-sm font-medium text-slate-300">
          Job name
        </label>
        <input
          id="job-definition-name"
          type="text"
          placeholder="e.g. order_volume_by_zip"
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

      <div>
        <label htmlFor="job-definition-sql" className="block text-sm font-medium text-slate-300">
          SQL
        </label>
        <textarea
          id="job-definition-sql"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={6}
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 p-3 font-mono text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <CronScheduleBuilder onChange={setCadenceCron} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isCreating || name.trim() === "" || sql.trim() === ""}
          className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isCreating ? "Creating…" : "Create job"}
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
