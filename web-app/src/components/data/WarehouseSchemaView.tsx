import type { ReactElement } from "react";
import type { WarehouseTable } from "../../models/warehouseSchema";

export interface WarehouseSchemaViewProps {
  tables: WarehouseTable[];
}

/*
 * <details>/<summary> gives per-table collapse/expand with zero JS and
 * full native keyboard support — no custom toggle button to wire up
 * aria-expanded on by hand. Collapsed by default: the three table names
 * stay visible, the ~15-column lists don't dominate the column until
 * expanded.
 */
function TableSchema({ table }: { table: WarehouseTable }): ReactElement {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        {table.table_name}
        <span className="ml-2 font-normal text-slate-500">({table.columns.length} columns)</span>
      </summary>
      <table className="mt-3 w-full border-collapse text-sm">
        <caption className="sr-only">Columns of the {table.table_name} warehouse table</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th scope="col" className="py-2 pr-4 font-medium">
              Column
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Type
            </th>
            <th scope="col" className="py-2 font-medium">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((column) => (
            <tr key={column.name} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-mono text-xs text-slate-700">{column.name}</td>
              <td className="py-2 pr-4 text-slate-500">{column.type}</td>
              <td className="py-2 text-slate-500">{column.comment ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * Read live from the Glue Data Catalog (7-data-warehousing.md §12) — every
 * column this renders is exactly what Athena will actually query against
 * right now, not a checked-in copy that can drift.
 */
export function WarehouseSchemaView({ tables }: WarehouseSchemaViewProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {tables.map((table) => (
        <TableSchema key={table.table_name} table={table} />
      ))}
    </div>
  );
}
