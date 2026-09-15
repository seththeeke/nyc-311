import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useSqlAutocomplete } from "../../../src/components/query/useSqlAutocomplete";
import type { WarehouseTable } from "../../../src/models/warehouseSchema";

const locations: WarehouseTable = {
  table_name: "locations",
  columns: [{ name: "borough", type: "string", comment: null }],
};

function useHarness(tables: WarehouseTable[]) {
  const [sql, setSql] = useState("");
  const autocomplete = useSqlAutocomplete(sql, setSql, tables);
  /* Mirrors what SqlQueryConsole's real onChange does: the caller owns `sql`, the hook only owns the popup state. */
  function changeText(value: string, cursor: number): void {
    setSql(value);
    autocomplete.handleTextChange(value, cursor);
  }
  return { sql, setSql, ...autocomplete, handleTextChange: changeText };
}

function keyEvent(key: string) {
  return { key, preventDefault: () => {} } as unknown as Parameters<
    ReturnType<typeof useHarness>["handleKeyDown"]
  >[0];
}

describe("useSqlAutocomplete", () => {
  it("starts with no suggestions", () => {
    const { result } = renderHook(() => useHarness([locations]));

    expect(result.current.suggestions).toEqual([]);
  });

  it("populates suggestions on a text change with a matching prefix", () => {
    const { result } = renderHook(() => useHarness([locations]));

    act(() => {
      result.current.handleTextChange("SELECT * FROM loc", 17);
    });

    expect(result.current.suggestions).toContain("locations");
  });

  it("clears suggestions when the current word no longer matches anything", () => {
    const { result } = renderHook(() => useHarness([locations]));

    act(() => result.current.handleTextChange("SELECT * FROM loc", 17));
    expect(result.current.suggestions.length).toBeGreaterThan(0);

    act(() => result.current.handleTextChange("SELECT * FROM loc ", 18));
    expect(result.current.suggestions).toEqual([]);
  });

  it("cycles the active index with ArrowDown/ArrowUp, wrapping around", () => {
    const { result } = renderHook(() => useHarness([locations]));
    act(() => result.current.handleTextChange("SELECT * FROM loc", 17));
    const count = result.current.suggestions.length;

    act(() => result.current.handleKeyDown(keyEvent("ArrowUp")));
    expect(result.current.activeIndex).toBe(count - 1);

    act(() => result.current.handleKeyDown(keyEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("selects the active suggestion on Enter and closes the menu", () => {
    const { result } = renderHook(() => useHarness([locations]));
    act(() => result.current.handleTextChange("SELECT * FROM loc", 17));

    act(() => result.current.handleKeyDown(keyEvent("Enter")));

    expect(result.current.sql).toBe("SELECT * FROM locations ");
    expect(result.current.suggestions).toEqual([]);
  });

  it("selects the active suggestion on Tab too", () => {
    const { result } = renderHook(() => useHarness([locations]));
    act(() => result.current.handleTextChange("SELECT * FROM loc", 17));

    act(() => result.current.handleKeyDown(keyEvent("Tab")));

    expect(result.current.sql).toBe("SELECT * FROM locations ");
  });

  it("closes the menu on Escape without changing the text", () => {
    const { result } = renderHook(() => useHarness([locations]));
    act(() => result.current.handleTextChange("SELECT * FROM loc", 17));

    act(() => result.current.handleKeyDown(keyEvent("Escape")));

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.sql).toBe("SELECT * FROM loc");
  });

  it("ignores keydowns when the menu is closed", () => {
    const { result } = renderHook(() => useHarness([locations]));

    act(() => result.current.handleKeyDown(keyEvent("Enter")));

    expect(result.current.sql).toBe("");
  });

  it("handleSelect is a no-op if called with no active word range", () => {
    const { result } = renderHook(() => useHarness([locations]));

    act(() => result.current.handleSelect("locations"));

    expect(result.current.sql).toBe("");
  });
});
