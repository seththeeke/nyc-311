import { useState, type ReactElement } from "react";
import type { WarehouseTable } from "../../models/warehouseSchema";
import { WarehouseSchemaView } from "./WarehouseSchemaView";

export interface WarehouseSchemaSearchProps {
  tables: WarehouseTable[];
}

/**
 * A basic frontend-only search box over the warehouse schema
 * (`10-capacity-modeling-and-integration.md` / admin warehouse redesign)
 * — matches a table's own name (keeping every column visible) or a
 * column name within it (narrowing to just the matching columns), no
 * backend round trip. Sits alongside the query editor so schema
 * reference and query authoring never need a second tab open.
 */
export function WarehouseSchemaSearch({ tables }: WarehouseSchemaSearchProps): ReactElement {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();
  const filtered =
    trimmed === ""
      ? tables
      : tables
          .map((table) => {
            const tableNameMatches = table.table_name.toLowerCase().includes(trimmed);
            return {
              ...table,
              columns: tableNameMatches ? table.columns : table.columns.filter((c) => c.name.toLowerCase().includes(trimmed)),
            };
          })
          .filter((table) => table.table_name.toLowerCase().includes(trimmed) || table.columns.length > 0);

  return (
    <div className="space-y-3">
      <label htmlFor="warehouse-schema-search" className="sr-only">
        Search schema
      </label>
      <input
        id="warehouse-schema-search"
        type="search"
        placeholder="Search tables or columns…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">No tables or columns match "{query}".</p>
      ) : (
        <div className="rounded-xl bg-white p-3">
          <WarehouseSchemaView tables={filtered} />
        </div>
      )}
    </div>
  );
}
