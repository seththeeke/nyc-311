import { describe, expect, it } from "vitest";
import {
  applySuggestion,
  extractTableReferences,
  getClauseContext,
  getCompletionRange,
  getCurrentWordRange,
  getSuggestions,
} from "../../../src/components/query/sqlAutocomplete";
import type { WarehouseTable } from "../../../src/models/warehouseSchema";

const orderEvents: WarehouseTable = {
  table_name: "order_events",
  columns: [
    { name: "order_id", type: "string", comment: null },
    { name: "occurred_at", type: "timestamp", comment: null },
  ],
};

const locations: WarehouseTable = {
  table_name: "locations",
  columns: [
    { name: "location_id", type: "string", comment: null },
    { name: "borough", type: "string", comment: null },
  ],
};

describe("getCurrentWordRange", () => {
  it("returns the identifier immediately before the cursor", () => {
    const text = "SELECT ord";
    expect(getCurrentWordRange(text, text.length)).toEqual({ start: 7, end: 10, word: "ord" });
  });

  it("returns an empty word when the cursor sits right after whitespace", () => {
    const text = "SELECT * FROM ";
    expect(getCurrentWordRange(text, text.length).word).toBe("");
  });

  it("includes dots, so a qualified column reference counts as one word", () => {
    const text = "SELECT t.col";
    expect(getCurrentWordRange(text, text.length)).toEqual({ start: 7, end: 12, word: "t.col" });
  });
});

describe("getCompletionRange", () => {
  it("matches getCurrentWordRange for an unqualified word", () => {
    const text = "SELECT * FROM loc";
    expect(getCompletionRange(text, text.length)).toEqual(getCurrentWordRange(text, text.length));
  });

  it("narrows to just the part after the last dot for a qualified reference", () => {
    const text = "SELECT o.ord";
    expect(getCompletionRange(text, text.length)).toEqual({ start: 9, end: 12, word: "ord" });
  });
});

describe("getClauseContext", () => {
  it("is UNKNOWN before any clause keyword", () => {
    expect(getClauseContext("ord", 3)).toBe("UNKNOWN");
    expect(getClauseContext("", 0)).toBe("UNKNOWN");
  });

  it("recognizes SELECT, FROM, WHERE", () => {
    expect(getClauseContext("SELECT ", 7)).toBe("SELECT");
    expect(getClauseContext("SELECT * FROM ", 14)).toBe("FROM");
    expect(getClauseContext("SELECT * FROM orders WHERE ", 28)).toBe("WHERE");
  });

  it("recognizes GROUP BY and ORDER BY as single clauses", () => {
    expect(getClauseContext("SELECT * FROM orders GROUP BY ", 31)).toBe("GROUP_BY");
    expect(getClauseContext("SELECT * FROM orders ORDER BY ", 31)).toBe("ORDER_BY");
  });

  it("recognizes JOIN variants and the ON that follows", () => {
    expect(getClauseContext("SELECT * FROM a JOIN ", 21)).toBe("JOIN");
    expect(getClauseContext("SELECT * FROM a LEFT JOIN ", 26)).toBe("JOIN");
    expect(getClauseContext("SELECT * FROM a JOIN b ON ", 26)).toBe("ON");
  });

  it("recognizes HAVING and LIMIT", () => {
    expect(getClauseContext("SELECT * FROM a GROUP BY x HAVING ", 34)).toBe("HAVING");
    expect(getClauseContext("SELECT * FROM a LIMIT ", 22)).toBe("LIMIT");
  });

  it("does not mistake a partially-typed keyword for a complete one", () => {
    expect(getClauseContext("SELECT * FROM a WHE", 19)).toBe("FROM");
  });

  it("uses the last complete clause keyword before the cursor, not the first", () => {
    const text = "SELECT * FROM orders WHERE x = 1";
    expect(getClauseContext(text, text.length)).toBe("WHERE");
  });
});

describe("extractTableReferences", () => {
  it("captures a table with an explicit alias", () => {
    expect(extractTableReferences("SELECT * FROM order_events o")).toEqual([{ table: "order_events", alias: "o" }]);
  });

  it("captures a table with an AS alias", () => {
    expect(extractTableReferences("SELECT * FROM order_events AS o")).toEqual([{ table: "order_events", alias: "o" }]);
  });

  it("captures a bare table with no alias", () => {
    expect(extractTableReferences("SELECT * FROM order_events")).toEqual([{ table: "order_events", alias: null }]);
  });

  it("does not mistake the next clause keyword for an alias", () => {
    expect(extractTableReferences("SELECT * FROM order_events WHERE x = 1")).toEqual([
      { table: "order_events", alias: null },
    ]);
  });

  it("captures every FROM/JOIN target across the whole query", () => {
    const text = "SELECT * FROM order_events o JOIN locations l ON o.location_id = l.location_id";
    expect(extractTableReferences(text)).toEqual([
      { table: "order_events", alias: "o" },
      { table: "locations", alias: "l" },
    ]);
  });
});

describe("getSuggestions", () => {
  it("returns nothing when the current word is empty", () => {
    expect(getSuggestions("SELECT * FROM ", 14, [orderEvents])).toEqual([]);
  });

  it("offers only table names in the FROM clause, never columns", () => {
    const text = "SELECT * FROM ord";
    const suggestions = getSuggestions(text, text.length, [orderEvents, locations]);

    expect(suggestions).toEqual(["order_events"]);
  });

  it("offers only table names after JOIN too", () => {
    const text = "SELECT * FROM order_events o JOIN loc";
    const suggestions = getSuggestions(text, text.length, [orderEvents, locations]);

    expect(suggestions).toEqual(["locations"]);
  });

  it("in the SELECT clause, scopes columns to tables already referenced via FROM, even written later in the query", () => {
    const text = "SELECT ord";
    const fullQuery = `${text} FROM order_events`;
    const suggestions = getSuggestions(fullQuery, text.length, [orderEvents, locations]);

    expect(suggestions).toEqual(["order_id"]);
  });

  it("in the SELECT clause with no FROM yet, falls back to every table's columns", () => {
    const text = "SELECT ord";
    const suggestions = getSuggestions(text, text.length, [orderEvents, locations]);

    expect(suggestions).toEqual(["order_id"]);
  });

  it("does not suggest a table name while in the SELECT clause", () => {
    const text = "SELECT ord";
    const fullQuery = `${text} FROM order_events`;
    const suggestions = getSuggestions(fullQuery, text.length, [orderEvents, locations]);

    expect(suggestions).not.toContain("order_events");
  });

  it("in the WHERE clause, offers scoped columns plus condition keywords", () => {
    const text = "SELECT * FROM locations WHERE bor";
    const suggestions = getSuggestions(text, text.length, [orderEvents, locations]);

    expect(suggestions).toEqual(["borough"]);
  });

  it("offers condition keywords in WHERE once a column-like prefix doesn't match", () => {
    const text = "SELECT * FROM locations WHERE borough = 'x' AN";
    const suggestions = getSuggestions(text, text.length, [orderEvents, locations]);

    expect(suggestions).toEqual(["AND"]);
  });

  it("in GROUP BY / ORDER BY, offers scoped columns plus ASC/DESC", () => {
    const text = "SELECT * FROM locations GROUP BY bor";
    expect(getSuggestions(text, text.length, [locations])).toEqual(["borough"]);

    const withDesc = "SELECT * FROM locations ORDER BY borough DE";
    expect(getSuggestions(withDesc, withDesc.length, [locations])).toEqual(["DESC"]);
  });

  it("offers nothing after LIMIT", () => {
    const text = "SELECT * FROM locations LIMIT 1";
    expect(getSuggestions(text, text.length, [locations])).toEqual([]);
  });

  it("resolves an alias-qualified reference to just that table's columns", () => {
    const text = "SELECT o.ord FROM order_events o JOIN locations l ON o.location_id = l.location_id";
    const cursor = "SELECT o.ord".length;

    expect(getSuggestions(text, cursor, [orderEvents, locations])).toEqual(["order_id"]);
  });

  it("resolves a bare table name used as its own qualifier", () => {
    const text = "SELECT order_events.ord FROM order_events";
    const cursor = "SELECT order_events.ord".length;

    expect(getSuggestions(text, cursor, [orderEvents, locations])).toEqual(["order_id"]);
  });

  it("returns nothing for a qualifier that doesn't resolve to any referenced table", () => {
    const text = "SELECT x.ord";
    expect(getSuggestions(text, text.length, [orderEvents, locations])).toEqual([]);
  });

  it("falls back to every identifier and keyword before any clause keyword", () => {
    const suggestions = getSuggestions("sel", 3, []);
    expect(suggestions).toContain("SELECT");
  });

  it("is case-insensitive", () => {
    const text = "SELECT * FROM LOC";
    expect(getSuggestions(text, text.length, [locations])).toEqual(["locations"]);
  });

  it("excludes a candidate that exactly equals the already-typed word", () => {
    const text = "SELECT * FROM locations";
    expect(getSuggestions(text, text.length, [locations])).toEqual([]);
  });

  it("caps suggestions at 8", () => {
    const manyTables: WarehouseTable[] = Array.from({ length: 20 }, (_, i) => ({
      table_name: `zzz_table_${i}`,
      columns: [],
    }));
    const suggestions = getSuggestions("zzz", 3, manyTables);

    expect(suggestions).toHaveLength(8);
  });
});

describe("applySuggestion", () => {
  it("replaces the word range with the suggestion plus a trailing space", () => {
    const text = "SELECT * FROM ord";
    const range = getCompletionRange(text, text.length);

    const result = applySuggestion(text, range, "order_events");

    expect(result.text).toBe("SELECT * FROM order_events ");
    expect(result.cursor).toBe(result.text.length);
  });

  it("preserves text after the cursor when replacing a mid-string word", () => {
    const text = "SELECT ord FROM order_events";
    const range = getCurrentWordRange(text, 10);

    const result = applySuggestion(text, range, "order_id");

    expect(result.text).toBe("SELECT order_id  FROM order_events");
    expect(result.cursor).toBe(16);
  });

  it("keeps the qualifier prefix intact when completing a dotted reference", () => {
    const text = "SELECT o.ord FROM order_events o";
    const cursor = "SELECT o.ord".length;
    const range = getCompletionRange(text, cursor);

    const result = applySuggestion(text, range, "order_id");

    expect(result.text).toBe("SELECT o.order_id  FROM order_events o");
  });
});
