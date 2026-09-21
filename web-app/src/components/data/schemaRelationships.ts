import type { WarehouseTable } from "../../models/warehouseSchema";

/*
 * The Glue catalog declares no foreign keys, so they're inferred by naming
 * convention from whatever tables /data/schema returns. A table's entity is
 * its name minus `_events`/`_snapshots` and a plural "s" (order_snapshots ->
 * order); the entity's owner is the non-events table, keyed by `<entity>_id`.
 * Any other `*_id` column ending in a known entity is a foreign key to that
 * owner. Ids with no matching table (case_id today) are skipped, not guessed.
 */

export interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface TableKeys {
  primaryKey: string | null;
  foreignKeys: ReadonlySet<string>;
}

export interface InferredSchema {
  relationships: Relationship[];
  keys: ReadonlyMap<string, TableKeys>;
}

const EVENTS_SUFFIX = "_events";
const ID_SUFFIX = "_id";

export function entityOf(tableName: string): string {
  const base = tableName.replace(/_(events|snapshots)$/, "");
  return base.length > 3 && base.endsWith("s") ? base.slice(0, -1) : base;
}

function ownersByEntity(tables: WarehouseTable[]): Map<string, WarehouseTable> {
  const owners = new Map<string, WarehouseTable>();
  for (const table of tables) {
    if (!table.table_name.endsWith(EVENTS_SUFFIX)) owners.set(entityOf(table.table_name), table);
  }
  for (const table of tables) {
    const entity = entityOf(table.table_name);
    if (!owners.has(entity)) owners.set(entity, table);
  }
  return owners;
}

/** `assigned_operator_id` -> tries "assigned_operator" then "operator"; the first known entity wins. */
function entityForColumn(column: string, owners: Map<string, WarehouseTable>): string | null {
  const tokens = column.slice(0, -ID_SUFFIX.length).split("_");
  for (let start = 0; start < tokens.length; start += 1) {
    const candidate = tokens.slice(start).join("_");
    if (owners.has(candidate)) return candidate;
  }
  return null;
}

export function inferRelationships(tables: WarehouseTable[]): InferredSchema {
  const owners = ownersByEntity(tables);
  const relationships: Relationship[] = [];
  const primaryKeys = new Map<string, string>();
  const foreignKeys = new Map<string, Set<string>>(tables.map((table) => [table.table_name, new Set<string>()]));

  for (const table of tables) {
    for (const column of table.columns) {
      if (!column.name.endsWith(ID_SUFFIX)) continue;
      const entity = entityForColumn(column.name, owners);
      const owner = entity ? owners.get(entity) : undefined;
      if (!entity || !owner) continue;
      const ownerKey = `${entity}${ID_SUFFIX}`;
      if (!owner.columns.some((c) => c.name === ownerKey)) continue;

      if (owner.table_name === table.table_name) {
        if (column.name === ownerKey) primaryKeys.set(table.table_name, column.name);
        continue;
      }
      relationships.push({
        fromTable: table.table_name,
        fromColumn: column.name,
        toTable: owner.table_name,
        toColumn: ownerKey,
      });
      foreignKeys.get(table.table_name)?.add(column.name);
    }
  }

  const keys = new Map<string, TableKeys>(
    tables.map((table) => [
      table.table_name,
      { primaryKey: primaryKeys.get(table.table_name) ?? null, foreignKeys: foreignKeys.get(table.table_name) ?? new Set() },
    ]),
  );
  return { relationships, keys };
}

export const BOX_WIDTH = 250;
export const HEADER_HEIGHT = 30;
export const ROW_HEIGHT = 22;
const COLUMN_GAP = 110;
const ROW_GAP = 28;
const PADDING = 16;
const BOX_BOTTOM_PAD = 8;

export interface DiagramRow {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface DiagramBox {
  table: WarehouseTable;
  x: number;
  y: number;
  height: number;
  rows: DiagramRow[];
  /* Columns not drawn in key-only mode. */
  hiddenCount: number;
}

export interface DiagramEdge {
  relationship: Relationship;
  path: string;
}

export interface DiagramLayout {
  width: number;
  height: number;
  boxes: DiagramBox[];
  edges: DiagramEdge[];
}

/** Parents sit to the right of their children: depth = longest FK chain from a table to a root (cycle-safe). */
function depthsOf(tables: WarehouseTable[], relationships: Relationship[]): Map<string, number> {
  const parents = new Map<string, string[]>(tables.map((t) => [t.table_name, []]));
  for (const rel of relationships) parents.get(rel.fromTable)?.push(rel.toTable);

  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (name: string): number => {
    const known = depths.get(name);
    if (known !== undefined) return known;
    if (visiting.has(name)) return 0;
    visiting.add(name);
    const depth = Math.max(-1, ...(parents.get(name) ?? []).map(depthOf)) + 1;
    visiting.delete(name);
    depths.set(name, depth);
    return depth;
  };
  tables.forEach((t) => depthOf(t.table_name));
  return depths;
}

function rowsFor(table: WarehouseTable, keys: TableKeys | undefined, showAll: boolean): { rows: DiagramRow[]; hidden: number } {
  const all = table.columns.map((column) => ({
    name: column.name,
    type: column.type,
    isPrimaryKey: keys?.primaryKey === column.name,
    isForeignKey: keys?.foreignKeys.has(column.name) ?? false,
  }));
  if (showAll) return { rows: all, hidden: 0 };
  const rows = all.filter((row) => row.isPrimaryKey || row.isForeignKey);
  return { rows, hidden: all.length - rows.length };
}

export function layoutDiagram(tables: WarehouseTable[], inferred: InferredSchema, showAll: boolean): DiagramLayout {
  const depths = depthsOf(tables, inferred.relationships);
  const maxDepth = Math.max(0, ...depths.values());
  const columnHeights = new Array<number>(maxDepth + 1).fill(PADDING);
  const boxes: DiagramBox[] = [];

  for (const table of tables) {
    const depth = depths.get(table.table_name) ?? 0;
    const { rows, hidden } = rowsFor(table, inferred.keys.get(table.table_name), showAll);
    const lines = rows.length + (hidden > 0 ? 1 : 0);
    const height = HEADER_HEIGHT + lines * ROW_HEIGHT + BOX_BOTTOM_PAD;
    const x = PADDING + (maxDepth - depth) * (BOX_WIDTH + COLUMN_GAP);
    boxes.push({ table, x, y: columnHeights[depth], height, rows, hiddenCount: hidden });
    columnHeights[depth] += height + ROW_GAP;
  }

  const boxByName = new Map(boxes.map((box) => [box.table.table_name, box]));
  const rowY = (box: DiagramBox, column: string): number => {
    const index = box.rows.findIndex((row) => row.name === column);
    return box.y + HEADER_HEIGHT + (Math.max(index, 0) + 0.5) * ROW_HEIGHT;
  };

  const edges: DiagramEdge[] = [];
  for (const relationship of inferred.relationships) {
    const from = boxByName.get(relationship.fromTable);
    const to = boxByName.get(relationship.toTable);
    if (!from || !to) continue;
    const x1 = from.x + BOX_WIDTH;
    const x2 = to.x;
    const bend = Math.max(40, Math.abs(x2 - x1) / 2);
    const y1 = rowY(from, relationship.fromColumn);
    const y2 = rowY(to, relationship.toColumn);
    edges.push({ relationship, path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` });
  }

  return {
    width: PADDING * 2 + (maxDepth + 1) * BOX_WIDTH + maxDepth * COLUMN_GAP,
    height: Math.max(...columnHeights) - ROW_GAP + PADDING,
    boxes,
    edges,
  };
}
