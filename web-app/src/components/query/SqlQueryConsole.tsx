import { useState, type ReactElement } from "react";
import { useWarehouseQuery } from "../../hooks/useWarehouseQuery";
import { QueryResultTable } from "./QueryResultTable";

const SQL_TEXTAREA_ID = "ad-hoc-sql-query";

export interface SqlQueryConsoleProps {
  /** Pre-fills the SQL textarea — set by the caller (e.g. a loaded job's SQL); render with a `key` that changes per load so this actually re-initializes. */
  initialSql?: string;
  /** The job currently loaded into this console, if any (`7-data-warehousing.md` §12b's job-edit flow) — drives the "Save to {name}" control. */
  activeJobName?: string | null;
  /** When provided, shows a "Save as job" control once a query has run successfully at least once (§12b, Leg 8). */
  onSaveAsJob?: (sql: string) => void;
  /** When provided alongside `activeJobName`, shows a "Save to {activeJobName}" control that overwrites that job's SQL in place. */
  onUpdateJob?: (sql: string) => void;
  isUpdating?: boolean;
  updateError?: Error | null;
}

/**
 * The admin ad-hoc SQL console (`7-data-warehousing.md` §12a, Leg 7) — a
 * SQL textarea, a Run button, and a result area. No history/persistence
 * of its own: every run is stateless, and a new run replaces whatever
 * result was showing. `initialSql` lets a caller seed the textarea (e.g.
 * a loaded job) — pair it with a changing `key` on this component to
 * re-seed on a later load, since the SQL itself stays internal state.
 */
export function SqlQueryConsole({
  initialSql,
  activeJobName,
  onSaveAsJob,
  onUpdateJob,
  isUpdating,
  updateError,
}: SqlQueryConsoleProps): ReactElement {
  const [sql, setSql] = useState(initialSql ?? "");
  const { runQuery, result, isRunning, error } = useWarehouseQuery();

  async function handleRun(): Promise<void> {
    if (!sql.trim() || isRunning) return;
    try {
      await runQuery(sql);
    } catch {
      /* error (from the hook's mutation state) already surfaces the failure below. */
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor={SQL_TEXTAREA_ID} className="block text-sm font-medium text-slate-300">
            SQL query
          </label>
          {activeJobName && (
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
              Editing job: <span className="font-mono">{activeJobName}</span>
            </span>
          )}
        </div>
        <textarea
          id={SQL_TEXTAREA_ID}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder="SELECT borough, COUNT(*) FROM locations GROUP BY borough"
          className="w-full rounded-lg border border-white/10 bg-slate-950 p-3 font-mono text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={isRunning || !sql.trim()}
        className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {isRunning ? "Running…" : "Run query"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error.message}
        </p>
      )}

      {result && !error && (
        <div className="space-y-2 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {result.row_count} row{result.row_count === 1 ? "" : "s"}
              {result.truncated && " (truncated at 500 — narrow the query to see more)"}
              {result.engine_execution_time_ms !== null && ` · ${result.engine_execution_time_ms}ms`}
            </p>
            <div className="flex items-center gap-2">
              {activeJobName && onUpdateJob && (
                <button
                  type="button"
                  onClick={() => onUpdateJob(sql)}
                  disabled={isUpdating}
                  className="rounded bg-cyan-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {isUpdating ? "Saving…" : `Save to ${activeJobName}`}
                </button>
              )}
              {onSaveAsJob && (
                <button
                  type="button"
                  onClick={() => onSaveAsJob(sql)}
                  className="rounded bg-white/10 px-3 py-1 text-sm text-slate-100 hover:bg-white/20"
                >
                  Save as job
                </button>
              )}
            </div>
          </div>
          {updateError && (
            <p role="alert" className="text-sm text-red-600">
              {updateError.message}
            </p>
          )}
          <QueryResultTable result={result} />
        </div>
      )}
    </div>
  );
}
