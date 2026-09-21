import { useId, useState, type ReactElement } from "react";
import { useWarehouseQuery } from "../../hooks/useWarehouseQuery";
import type { WarehouseTable } from "../../models/warehouseSchema";
import { QueryResultTable } from "./QueryResultTable";
import { SqlAutocompleteMenu } from "./SqlAutocompleteMenu";
import { useSqlAutocomplete } from "./useSqlAutocomplete";

export interface SqlQueryConsoleProps {
  /** Pre-fills the SQL textarea — set by the caller (e.g. a loaded job's SQL); render with a `key` that changes per load so this actually re-initializes. */
  initialSql?: string;
  /** The job currently loaded into this console, if any (`7-data-warehousing.md` §12b's job-edit flow) — drives the "Save to {name}" control. */
  activeJobName?: string | null;
  /** Table/column names for the schema-aware typeahead — omit (or pass []) to fall back to keyword-only suggestions. */
  tables?: WarehouseTable[];
  /** When provided, shows a "Save as job" control once a query has run successfully at least once (§12b, Leg 8). */
  onSaveAsJob?: (sql: string) => void;
  /** When provided, shows a "Save as query" control — a saved query, distinct from a scheduled job (admin warehouse query-tabs enhancement). */
  onSaveAsQuery?: (sql: string) => void;
  /** When provided alongside `activeJobName`, shows a "Save to {activeJobName}" control that overwrites that job's SQL in place. */
  onUpdateJob?: (sql: string) => void;
  isUpdating?: boolean;
  updateError?: Error | null;
  /** Fires on every keystroke with the current SQL text — lets a caller (e.g. the query-tabs workspace) mirror it for persistence, without making this component controlled. */
  onSqlChange?: (sql: string) => void;
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
  tables,
  onSaveAsJob,
  onSaveAsQuery,
  onUpdateJob,
  isUpdating,
  updateError,
  onSqlChange,
}: SqlQueryConsoleProps): ReactElement {
  const sqlTextareaId = useId();
  const [sql, setSql] = useState(initialSql ?? "");
  const { runQuery, result, isRunning, error } = useWarehouseQuery();

  /* Routes every sql update — typed or an applied autocomplete selection alike — through onSqlChange, so a caller mirroring this for persistence (e.g. the query-tabs workspace) never misses one. */
  function updateSql(value: string): void {
    setSql(value);
    onSqlChange?.(value);
  }

  const { suggestions, activeIndex, textareaRef, handleTextChange, handleKeyDown, handleSelect } = useSqlAutocomplete(
    sql,
    updateSql,
    tables ?? []
  );

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
          <label htmlFor={sqlTextareaId} className="block text-sm font-medium text-fg-muted">
            SQL query
          </label>
          {activeJobName && (
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-hue-cyan">
              Editing job: <span className="font-mono">{activeJobName}</span>
            </span>
          )}
        </div>
        <textarea
          id={sqlTextareaId}
          ref={textareaRef}
          value={sql}
          onChange={(e) => {
            updateSql(e.target.value);
            handleTextChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={handleKeyDown}
          rows={6}
          spellCheck={false}
          placeholder="SELECT borough, COUNT(*) FROM locations GROUP BY borough"
          className="w-full rounded-lg border border-line bg-surface p-3 font-mono text-sm text-fg focus:border-emerald-500 focus:outline-none"
        />
        {suggestions.length > 0 && (
          <SqlAutocompleteMenu suggestions={suggestions} activeIndex={activeIndex} onSelect={handleSelect} />
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleRun()}
        disabled={isRunning || !sql.trim()}
        className="rounded bg-emerald-600 px-4 py-2 text-on-accent disabled:opacity-50"
      >
        {isRunning ? "Running…" : "Run query"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}

      {result && !error && (
        <div className="space-y-2 rounded-2xl bg-panel p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-fg-subtle">
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
                  className="rounded bg-cyan-600 px-3 py-1 text-sm text-on-accent disabled:opacity-50"
                >
                  {isUpdating ? "Saving…" : `Save to ${activeJobName}`}
                </button>
              )}
              {onSaveAsQuery && (
                <button
                  type="button"
                  onClick={() => onSaveAsQuery(sql)}
                  className="rounded bg-panel-hover px-3 py-1 text-sm text-fg hover:bg-panel-strong"
                >
                  Save as query
                </button>
              )}
              {onSaveAsJob && (
                <button
                  type="button"
                  onClick={() => onSaveAsJob(sql)}
                  className="rounded bg-panel-hover px-3 py-1 text-sm text-fg hover:bg-panel-strong"
                >
                  Save as job
                </button>
              )}
            </div>
          </div>
          {updateError && (
            <p role="alert" className="text-sm text-danger">
              {updateError.message}
            </p>
          )}
          <QueryResultTable result={result} />
        </div>
      )}
    </div>
  );
}
