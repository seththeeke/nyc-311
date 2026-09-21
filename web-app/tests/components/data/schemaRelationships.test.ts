import { describe, expect, it } from "vitest";
import { entityOf, inferRelationships, layoutDiagram, BOX_WIDTH } from "../../../src/components/data/schemaRelationships";
import type { WarehouseTable } from "../../../src/models/warehouseSchema";
import { LIVE_TABLES } from "../../testUtils/warehouseTables";

const edge = (r: { fromTable: string; fromColumn: string; toTable: string; toColumn: string }) =>
  `${r.fromTable}.${r.fromColumn} -> ${r.toTable}.${r.toColumn}`;

describe("entityOf", () => {
  it("strips _events/_snapshots and a plural s", () => {
    expect(entityOf("order_events")).toBe("order");
    expect(entityOf("operator_snapshots")).toBe("operator");
    expect(entityOf("requests")).toBe("request");
    expect(entityOf("locations")).toBe("location");
  });

  it("leaves short or non-plural names alone", () => {
    expect(entityOf("gas")).toBe("gas");
    expect(entityOf("audit")).toBe("audit");
  });
});

describe("inferRelationships (live catalog shape)", () => {
  const { relationships, keys } = inferRelationships(LIVE_TABLES);

  it("points each event table at its snapshot table, not at itself", () => {
    const edges = relationships.map(edge);
    expect(edges).toContain("order_events.order_id -> order_snapshots.order_id");
    expect(edges).toContain("operator_events.operator_id -> operator_snapshots.operator_id");
  });

  it("finds the snapshot/request/location foreign keys, including a prefixed one (assigned_operator_id)", () => {
    const edges = relationships.map(edge);
    expect(edges).toContain("order_snapshots.request_id -> requests.request_id");
    expect(edges).toContain("order_snapshots.location_id -> locations.location_id");
    expect(edges).toContain("requests.location_id -> locations.location_id");
    expect(edges).toContain("order_snapshots.assigned_operator_id -> operator_snapshots.operator_id");
  });

  it("finds exactly those six and skips ids with no matching table (case_id) and non-id columns", () => {
    expect(relationships).toHaveLength(6);
    expect(relationships.some((r) => r.fromColumn === "case_id")).toBe(false);
    expect(relationships.some((r) => r.fromColumn === "created_by")).toBe(false);
  });

  it("marks primary keys on owner tables only, and foreign keys on referencing tables", () => {
    expect(keys.get("order_snapshots")?.primaryKey).toBe("order_id");
    expect(keys.get("requests")?.primaryKey).toBe("request_id");
    expect(keys.get("locations")?.primaryKey).toBe("location_id");
    expect(keys.get("order_events")?.primaryKey).toBeNull();
    expect([...(keys.get("order_snapshots")?.foreignKeys ?? [])].sort()).toEqual(["assigned_operator_id", "location_id", "request_id"]);
    expect(keys.get("locations")?.foreignKeys.size).toBe(0);
  });
});

describe("inferRelationships (edge cases)", () => {
  const t = (table_name: string, cols: string[]): WarehouseTable => ({
    table_name,
    columns: cols.map((name) => ({ name, type: "string", comment: null })),
  });

  it("finds nothing in an empty or single-table schema", () => {
    expect(inferRelationships([]).relationships).toEqual([]);
    expect(inferRelationships([t("locations", ["location_id", "bbl"])]).relationships).toEqual([]);
  });

  it("ignores a self-reference (e.g. a parent id pointing at its own table)", () => {
    const { relationships } = inferRelationships([t("requests", ["request_id", "parent_request_id"])]);
    expect(relationships).toEqual([]);
  });

  it("only links to an owner that actually has the key column", () => {
    const { relationships } = inferRelationships([t("requests", ["name"]), t("order_snapshots", ["request_id"])]);
    expect(relationships).toEqual([]);
  });

  it("falls back to an events table when no snapshot/plain table owns the entity", () => {
    const { relationships } = inferRelationships([t("case_events", ["case_id"]), t("notes", ["note_id", "case_id"])]);
    expect(relationships.map(edge)).toEqual(["notes.case_id -> case_events.case_id"]);
  });
});

describe("layoutDiagram", () => {
  const inferred = inferRelationships(LIVE_TABLES);

  it("puts children left of the tables they reference (deeper FK chain = further left)", () => {
    const layout = layoutDiagram(LIVE_TABLES, inferred, false);
    const x = (name: string) => layout.boxes.find((b) => b.table.table_name === name)!.x;
    expect(x("order_events")).toBeLessThan(x("order_snapshots"));
    expect(x("order_snapshots")).toBeLessThan(x("requests"));
    expect(x("requests")).toBeLessThan(x("locations"));
    expect(x("operator_events")).toBeLessThan(x("operator_snapshots"));
  });

  it("stacks tables that share a depth without overlapping", () => {
    const layout = layoutDiagram(LIVE_TABLES, inferred, false);
    const roots = layout.boxes.filter((b) => b.x === Math.max(...layout.boxes.map((c) => c.x)));
    expect(roots.length).toBeGreaterThan(1);
    const sorted = [...roots].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i += 1) expect(sorted[i].y).toBeGreaterThanOrEqual(sorted[i - 1].y + sorted[i - 1].height);
  });

  it("key-only mode draws just PK/FK rows plus a hidden-count; show-all draws every column", () => {
    const keyOnly = layoutDiagram(LIVE_TABLES, inferred, false).boxes.find((b) => b.table.table_name === "order_snapshots")!;
    expect(keyOnly.rows.map((r) => r.name)).toEqual(["order_id", "request_id", "location_id", "assigned_operator_id"]);
    expect(keyOnly.hiddenCount).toBe(3);
    const all = layoutDiagram(LIVE_TABLES, inferred, true).boxes.find((b) => b.table.table_name === "order_snapshots")!;
    expect(all.rows).toHaveLength(7);
    expect(all.hiddenCount).toBe(0);
    expect(all.height).toBeGreaterThan(keyOnly.height);
  });

  it("draws one edge path per relationship, from a child's right edge to its parent's left edge", () => {
    const layout = layoutDiagram(LIVE_TABLES, inferred, false);
    expect(layout.edges).toHaveLength(6);
    const events = layout.boxes.find((b) => b.table.table_name === "order_events")!;
    const eventsEdge = layout.edges.find((e) => e.relationship.fromTable === "order_events")!;
    expect(eventsEdge.path.startsWith(`M ${events.x + BOX_WIDTH} `)).toBe(true);
  });

  it("sizes the canvas to contain every box", () => {
    const layout = layoutDiagram(LIVE_TABLES, inferred, true);
    for (const box of layout.boxes) {
      expect(box.x + BOX_WIDTH).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it("survives a foreign-key cycle without hanging", () => {
    const t = (table_name: string, cols: string[]): WarehouseTable => ({
      table_name,
      columns: cols.map((name) => ({ name, type: "string", comment: null })),
    });
    const tables = [t("alphas", ["alpha_id", "beta_id"]), t("betas", ["beta_id", "alpha_id"])];
    const layout = layoutDiagram(tables, inferRelationships(tables), false);
    expect(layout.boxes).toHaveLength(2);
    expect(layout.edges).toHaveLength(2);
  });

  it("lays out an empty schema as a minimal canvas", () => {
    const layout = layoutDiagram([], inferRelationships([]), false);
    expect(layout.boxes).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
  });
});
