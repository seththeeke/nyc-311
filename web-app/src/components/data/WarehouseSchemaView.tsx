import type { ReactElement } from "react";
import type { WarehouseTable } from "../../models/warehouseSchema";

export interface WarehouseSchemaViewProps {
  tables: WarehouseTable[];
  /** Opens every table's column list — set while a search is active so matches are visible without a click. */
  expanded?: boolean;
}

/*
 * <details>/<summary> gives per-table collapse/expand with zero JS and
 * full native keyboard support — no custom toggle button to wire up
 * aria-expanded on by hand. Collapsed by default: the three table names
 * stay visible, the ~15-column lists don't dominate the column until
 * expanded.
 */
function TableSchema({ table, expanded }: { table: WarehouseTable; expanded: boolean }): ReactElement {
  return (
    <details open={expanded} className="rounded-xl border border-line bg-panel p-3">
      <summary className="cursor-pointer text-sm font-semibold text-fg">
        {table.table_name}
        <span className="ml-2 font-normal text-fg-subtle">({table.columns.length} columns)</span>
      </summary>
      <table className="mt-3 w-full table-fixed border-collapse text-xs">
        <caption className="sr-only">Columns of the {table.table_name} warehouse table</caption>
        <thead>
          <tr className="border-b border-line text-left text-fg-subtle">
            <th scope="col" className="w-[38%] py-2 pr-2 font-medium">
              Column
            </th>
            <th scope="col" className="w-[24%] py-2 pr-2 font-medium">
              Type
            </th>
            <th scope="col" className="w-[38%] py-2 font-medium">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {table.columns.map((column) => (
            <tr key={column.name} className="border-b border-line-soft">
              <td className="py-2 pr-2 font-mono break-words text-fg-muted">{column.name}</td>
              <td className="py-2 pr-2 break-words text-fg-subtle">{column.type}</td>
              <td className="py-2 break-words text-fg-subtle">{column.comment ?? ""}</td>
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
export function WarehouseSchemaView({ tables, expanded = false }: WarehouseSchemaViewProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {tables.map((table) => (
        <TableSchema key={table.table_name} table={table} expanded={expanded} />
      ))}
    </div>
  );
}
