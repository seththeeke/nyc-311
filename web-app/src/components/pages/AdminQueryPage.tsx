import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { SqlQueryConsole } from "../query/SqlQueryConsole";

/**
 * The admin-gated SQL console page (`7-data-warehousing.md` §12a, Leg 7)
 * — run a one-off read-only query against the warehouse and see the
 * result, no `.sql` file or deploy required.
 */
export function AdminQueryPage(): ReactElement {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-slate-400 hover:text-slate-200">
        &larr; Admin
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">SQL Query</h1>
      <p className="mt-1 text-slate-600">
        Run a one-off, read-only query (SELECT/WITH/SHOW/DESCRIBE/EXPLAIN) against the warehouse and see the result.
        Nothing is saved — every run is stateless.
      </p>

      <div className="mt-8 rounded-2xl bg-slate-950 p-6">
        <SqlQueryConsole />
      </div>
    </main>
  );
}
