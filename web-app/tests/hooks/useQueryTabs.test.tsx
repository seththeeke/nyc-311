import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQueryTabs } from "../../src/hooks/useQueryTabs";
import type { WarehouseJobDefinition } from "../../src/models/warehouseJobDefinition";

const STORAGE_KEY = "nyc311.adminWarehouse.queryTabs.v1";

const job: WarehouseJobDefinition = {
  job_run_id: "DEF#order_volume_by_zip",
  record_type: "DEFINITION",
  job_name: "order_volume_by_zip",
  sql_s3_key: "job-definitions/order_volume_by_zip.sql",
  job_type: "SCHEDULED",
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useQueryTabs", () => {
  it("starts with one blank tab when localStorage is empty", () => {
    const { result } = renderHook(() => useQueryTabs());

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].sql).toBe("");
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
  });

  it("addTab appends a new blank tab and makes it active", () => {
    const { result } = renderHook(() => useQueryTabs());
    const firstId = result.current.tabs[0].id;

    act(() => result.current.addTab());

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.tabs[1].label).toBe("Untitled query 2");
    expect(result.current.activeTabId).toBe(result.current.tabs[1].id);
    expect(result.current.tabs[0].id).toBe(firstId);
  });

  it("updateTabSql updates only the targeted tab", () => {
    const { result } = renderHook(() => useQueryTabs());
    const firstId = result.current.tabs[0].id;
    act(() => result.current.addTab());
    const secondId = result.current.tabs[1].id;

    act(() => result.current.updateTabSql(firstId, "SELECT 1"));

    expect(result.current.tabs.find((t) => t.id === firstId)?.sql).toBe("SELECT 1");
    expect(result.current.tabs.find((t) => t.id === secondId)?.sql).toBe("");
  });

  it("closeTab removes a tab and activates the last remaining one when the active tab was closed", () => {
    const { result } = renderHook(() => useQueryTabs());
    const firstId = result.current.tabs[0].id;
    act(() => result.current.addTab());
    const secondId = result.current.tabs[1].id;
    act(() => result.current.setActiveTabId(secondId));

    act(() => result.current.closeTab(secondId));

    expect(result.current.tabs.map((t) => t.id)).toEqual([firstId]);
    expect(result.current.activeTabId).toBe(firstId);
  });

  it("closeTab leaves the active tab alone when closing a different (inactive) tab", () => {
    const { result } = renderHook(() => useQueryTabs());
    const firstId = result.current.tabs[0].id;
    act(() => result.current.addTab());
    const secondId = result.current.tabs[1].id;

    act(() => result.current.closeTab(firstId));

    expect(result.current.tabs.map((t) => t.id)).toEqual([secondId]);
    expect(result.current.activeTabId).toBe(secondId);
  });

  it("closeTab refuses to close the last remaining tab", () => {
    const { result } = renderHook(() => useQueryTabs());
    const onlyId = result.current.tabs[0].id;

    act(() => result.current.closeTab(onlyId));

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].id).toBe(onlyId);
  });

  it("openLoadedTab always opens a new tab seeded from the job", () => {
    const { result } = renderHook(() => useQueryTabs());

    act(() => result.current.openLoadedTab(job, "SELECT 1"));

    expect(result.current.tabs).toHaveLength(2);
    const loaded = result.current.tabs[1];
    expect(loaded.label).toBe("order_volume_by_zip");
    expect(loaded.sql).toBe("SELECT 1");
    expect(loaded.activeJobName).toBe("order_volume_by_zip");
    expect(loaded.jobType).toBe("SCHEDULED");
    expect(result.current.activeTabId).toBe(loaded.id);
  });

  it("persists tabs to localStorage on every change", () => {
    const { result } = renderHook(() => useQueryTabs());

    act(() => result.current.updateTabSql(result.current.tabs[0].id, "SELECT 1"));

    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored).toMatchObject({ tabs: [{ sql: "SELECT 1" }] });
  });

  it("hydrates tabs and the active tab from localStorage on mount", () => {
    const stored = {
      tabs: [
        { id: "tab-1", label: "Saved one", sql: "SELECT 1", activeJobName: null, jobType: null },
        { id: "tab-2", label: "Saved two", sql: "SELECT 2", activeJobName: null, jobType: null },
      ],
      activeTabId: "tab-2",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useQueryTabs());

    expect(result.current.tabs).toEqual(stored.tabs);
    expect(result.current.activeTabId).toBe("tab-2");
  });

  it("falls back to a fresh tab when the stored activeTabId doesn't match any tab", () => {
    const stored = {
      tabs: [{ id: "tab-1", label: "Saved one", sql: "SELECT 1", activeJobName: null, jobType: null }],
      activeTabId: "ghost",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useQueryTabs());

    expect(result.current.activeTabId).toBe("tab-1");
  });

  it("falls back to a fresh blank tab when localStorage holds unparseable JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    const { result } = renderHook(() => useQueryTabs());

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].sql).toBe("");
  });

  it("falls back to a fresh blank tab when localStorage holds an unrecognized shape", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: "not an array" }));

    const { result } = renderHook(() => useQueryTabs());

    expect(result.current.tabs).toHaveLength(1);
  });

  it("falls back to a fresh blank tab when the stored tabs array is empty", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: [], activeTabId: "x" }));

    const { result } = renderHook(() => useQueryTabs());

    expect(result.current.tabs).toHaveLength(1);
  });
});
