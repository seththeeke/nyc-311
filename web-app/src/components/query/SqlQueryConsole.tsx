import { useState, type ReactElement } from "react";
import { useWarehouseQuery } from "../../hooks/useWarehouseQuery";
import { QueryResultTable } from "./QueryResultTable";

const SQL_TEXTAREA_ID = "ad-hoc-sql-query";

/**
 * The admin ad-hoc SQL console (`7-data-warehousing.md` §12a, Leg 7) — a
 * SQL textarea, a Run button, and a result area. No history/persistence:
 * every run is stateless, and a new run replaces whatever result was
 * showing (CLAUDE.md §5.1's 200-line component cap keeps this to input +
 * result, `QueryResultTable` owns rendering the resultset itself).
 */
export function SqlQueryConsole(): ReactElement {
  const [sql, setSql] = useState("");
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
        <label htmlFor={SQL_TEXTAREA_ID} className="block text-sm font-medium text-slate-300">
          SQL query
        </label>
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
          <p className="text-xs text-slate-500">
            {result.row_count} row{result.row_count === 1 ? "" : "s"}
            {result.truncated && " (truncated at 500 — narrow the query to see more)"}
            {result.engine_execution_time_ms !== null && ` · ${result.engine_execution_time_ms}ms`}
          </p>
          <QueryResultTable result={result} />
        </div>
      )}
    </div>
  );
}
