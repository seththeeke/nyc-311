import { describe, expect, it } from "vitest";
import { applySuggestion, getCurrentWordRange, getSuggestions } from "../../../src/components/query/sqlAutocomplete";
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
  columns: [{ name: "borough", type: "string", comment: null }],
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

describe("getSuggestions", () => {
  it("returns nothing when the current word is empty", () => {
    expect(getSuggestions("SELECT * FROM ", 14, [orderEvents])).toEqual([]);
  });

  it("matches table and column names ahead of keywords", () => {
    const text = "SELECT * FROM ord";
    const suggestions = getSuggestions(text, text.length, [orderEvents, locations]);

    expect(suggestions).toContain("order_events");
    expect(suggestions).toContain("order_id");
    expect(suggestions.indexOf("order_events")).toBeLessThan(suggestions.indexOf("ORDER BY"));
  });

  it("matches SQL keywords by prefix", () => {
    const text = "sel";
    const suggestions = getSuggestions(text, text.length, []);

    expect(suggestions).toContain("SELECT");
  });

  it("is case-insensitive", () => {
    const text = "SELECT * FROM LOC";
    const suggestions = getSuggestions(text, text.length, [locations]);

    expect(suggestions).toContain("locations");
  });

  it("excludes a candidate that exactly equals the already-typed word", () => {
    const text = "SELECT * FROM locations";
    const suggestions = getSuggestions(text, text.length, [locations]);

    expect(suggestions).not.toContain("locations");
  });

  it("caps suggestions at 8", () => {
    const manyTables: WarehouseTable[] = Array.from({ length: 20 }, (_, i) => ({
      table_name: `zzz_table_${i}`,
      columns: [],
    }));
    const text = "zzz";
    const suggestions = getSuggestions(text, text.length, manyTables);

    expect(suggestions).toHaveLength(8);
  });
});

describe("applySuggestion", () => {
  it("replaces the word range with the suggestion plus a trailing space", () => {
    const text = "SELECT * FROM ord";
    const range = getCurrentWordRange(text, text.length);

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
});
