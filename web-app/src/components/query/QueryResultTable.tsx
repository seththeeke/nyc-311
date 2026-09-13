import type { ReactElement } from "react";
import type { AdHocQueryResult } from "../../models/adHocQueryResult";

export interface QueryResultTableProps {
  result: AdHocQueryResult;
}

const NUMERIC_TYPES = new Set(["bigint", "integer", "int", "smallint", "tinyint", "double", "real", "float", "decimal"]);

/**
 * Renders one ad-hoc query's resultset (`7-data-warehousing.md` §12a) — a
 * close cousin of `GenericResultTable`, off the same `columns`/`rows`
 * shape, without the job-run caption that shape doesn't have here.
 */
export function QueryResultTable({ result }: QueryResultTableProps): ReactElement {
  if (result.rows.length === 0) {
    return <p className="text-slate-500">The query returned no rows.</p>;
  }

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-100">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-white/95 backdrop-blur-sm">
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {result.columns.map((col) => (
              <th
                key={col.name}
                scope="col"
                className={`py-2 pr-4 font-medium ${NUMERIC_TYPES.has(col.type) ? "text-right" : ""}`}
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-b-0">
              {result.columns.map((col) => {
                const isNumeric = NUMERIC_TYPES.has(col.type);
                return (
                  <td
                    key={col.name}
                    className={`py-2 pr-4 text-slate-700 ${isNumeric ? "text-right tabular-nums" : "font-mono text-xs"}`}
                  >
                    {r[col.name] ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
