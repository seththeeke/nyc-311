import { useMemo, useState, type ReactElement } from "react";
import type { WarehouseTable } from "../../models/warehouseSchema";
import { BOX_WIDTH, HEADER_HEIGHT, ROW_HEIGHT, inferRelationships, layoutDiagram, type DiagramBox } from "./schemaRelationships";

export interface WarehouseRelationshipDiagramProps {
  tables: WarehouseTable[];
}

const MARKER_ID = "fk-arrow";

function TableBox({ box }: { box: DiagramBox }): ReactElement {
  const { table, x, y, height, rows, hiddenCount } = box;
  return (
    <g>
      <rect x={x} y={y} width={BOX_WIDTH} height={height} rx={8} className="fill-popover stroke-line-strong" />
      <rect x={x} y={y} width={BOX_WIDTH} height={HEADER_HEIGHT} rx={8} className="fill-panel-hover" />
      <text x={x + 12} y={y + HEADER_HEIGHT / 2 + 4} className="fill-fg text-[13px] font-semibold">
        {table.table_name}
      </text>
      {rows.map((row, index) => {
        const rowTop = y + HEADER_HEIGHT + index * ROW_HEIGHT;
        return (
          <g key={row.name}>
            <text x={x + 12} y={rowTop + 15} className="fill-hue-amber text-[9px] font-bold">
              {row.isPrimaryKey ? "PK" : ""}
            </text>
            <text x={x + 12} y={rowTop + 15} className="fill-hue-cyan text-[9px] font-bold">
              {row.isForeignKey ? "FK" : ""}
            </text>
            <text x={x + 34} y={rowTop + 15} className="fill-fg-muted font-mono text-[11px]">
              {row.name}
            </text>
            <text x={x + BOX_WIDTH - 10} y={rowTop + 15} textAnchor="end" className="fill-fg-subtle text-[10px]">
              {row.type}
            </text>
          </g>
        );
      })}
      {hiddenCount > 0 && (
        <text
          x={x + 12}
          y={y + HEADER_HEIGHT + rows.length * ROW_HEIGHT + 15}
          className="fill-fg-subtle text-[10px] italic"
        >
          + {hiddenCount} other column{hiddenCount === 1 ? "" : "s"}
        </text>
      )}
    </g>
  );
}

/**
 * Built on the fly from the schema the page already loaded — no extra call,
 * and it tracks the catalog. Foreign keys are inferred from `*_id` column
 * names (the catalog declares none — see `schemaRelationships.ts`), drawn as
 * arrows from the referencing column to the key it points at. Children sit
 * left of the tables they reference.
 */
export function WarehouseRelationshipDiagram({ tables }: WarehouseRelationshipDiagramProps): ReactElement {
  const [showAll, setShowAll] = useState(false);
  const inferred = useMemo(() => inferRelationships(tables), [tables]);
  const layout = useMemo(() => layoutDiagram(tables, inferred, showAll), [tables, inferred, showAll]);

  return (
    <div className="glass rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-subtle">
          Foreign keys are inferred from <code className="font-mono">*_id</code> column names — the catalog doesn&apos;t
          declare them.
        </p>
        <button
          type="button"
          aria-pressed={showAll}
          onClick={() => setShowAll((current) => !current)}
          className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-fg-muted hover:bg-panel-hover hover:text-fg"
        >
          {showAll ? "Key columns only" : "Show all columns"}
        </button>
      </div>

      {inferred.relationships.length === 0 ? (
        <p className="mt-3 text-sm text-fg-subtle">No foreign-key relationships could be inferred from these tables.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <svg
            role="img"
            aria-label={`Relationship diagram: ${tables.length} tables, ${inferred.relationships.length} foreign-key relationships`}
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="block max-w-none"
          >
            <defs>
              <marker id={MARKER_ID} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-hue-cyan" />
              </marker>
            </defs>
            {layout.edges.map(({ relationship, path }) => (
              <path
                key={`${relationship.fromTable}.${relationship.fromColumn}`}
                d={path}
                fill="none"
                strokeWidth={1.5}
                markerEnd={`url(#${MARKER_ID})`}
                className="stroke-hue-cyan"
              />
            ))}
            {layout.boxes.map((box) => (
              <TableBox key={box.table.table_name} box={box} />
            ))}
          </svg>
          <ul className="sr-only" aria-label="Foreign-key relationships">
            {inferred.relationships.map((rel) => (
              <li key={`${rel.fromTable}.${rel.fromColumn}`}>
                {rel.fromTable}.{rel.fromColumn} references {rel.toTable}.{rel.toColumn}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
