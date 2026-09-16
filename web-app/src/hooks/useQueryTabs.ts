import { useEffect, useState } from "react";
import type { WarehouseJobDefinition, WarehouseJobType } from "../models/warehouseJobDefinition";

export interface QueryTab {
  id: string;
  label: string;
  sql: string;
  activeJobName: string | null;
  jobType: WarehouseJobType | null;
}

interface QueryTabsState {
  tabs: QueryTab[];
  activeTabId: string;
}

export interface UseQueryTabsResult {
  tabs: QueryTab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  addTab: () => void;
  /** No-ops when this is the only remaining tab — at least one tab always stays open. */
  closeTab: (id: string) => void;
  updateTabSql: (id: string, sql: string) => void;
  /** Always opens a new tab, seeded from a loaded job's/saved query's SQL. */
  openLoadedTab: (job: WarehouseJobDefinition, sql: string) => void;
}

const STORAGE_KEY = "nyc311.adminWarehouse.queryTabs.v1";

function blankTab(label: string): QueryTab {
  return { id: crypto.randomUUID(), label, sql: "", activeJobName: null, jobType: null };
}

function isQueryTab(value: unknown): value is QueryTab {
  if (typeof value !== "object" || value === null) return false;
  const tab = value as Partial<QueryTab>;
  return typeof tab.id === "string" && typeof tab.label === "string" && typeof tab.sql === "string";
}

function isQueryTabsState(value: unknown): value is QueryTabsState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<QueryTabsState>;
  return Array.isArray(state.tabs) && state.tabs.every(isQueryTab) && typeof state.activeTabId === "string";
}

function freshState(): QueryTabsState {
  const tab = blankTab("Untitled query");
  return { tabs: [tab], activeTabId: tab.id };
}

/*
 * Hydrates from localStorage (sql text + tab metadata, never query
 * results — losing those to a refresh is fine per the admin warehouse
 * query-tabs enhancement). Any parse failure or unrecognized shape falls
 * back to one fresh blank tab rather than surfacing an error.
 */
function loadInitialState(): QueryTabsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed: unknown = JSON.parse(raw);
    if (!isQueryTabsState(parsed) || parsed.tabs.length === 0) return freshState();
    const activeTabId = parsed.tabs.some((tab) => tab.id === parsed.activeTabId) ? parsed.activeTabId : parsed.tabs[0].id;
    return { tabs: parsed.tabs, activeTabId };
  } catch {
    return freshState();
  }
}

/**
 * Owns the admin warehouse query console's tabs — multiple in-progress
 * queries at once, persisted to `localStorage` so a refresh reloads what
 * was being worked on. Components call hooks, never services, directly
 * (CLAUDE.md §5.1); this hook has no service of its own since
 * `localStorage` is the only backing store.
 */
export function useQueryTabs(): UseQueryTabsResult {
  const [state, setState] = useState<QueryTabsState>(loadInitialState);
  const { tabs, activeTabId } = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Private browsing / storage quota — tab persistence is a convenience only, safe to skip silently. */
    }
  }, [state]);

  function setActiveTabId(id: string): void {
    setState((prev) => ({ ...prev, activeTabId: id }));
  }

  function addTab(): void {
    const tab = blankTab(`Untitled query ${tabs.length + 1}`);
    setState((prev) => ({ tabs: [...prev.tabs, tab], activeTabId: tab.id }));
  }

  function closeTab(id: string): void {
    if (tabs.length <= 1) return;
    setState((prev) => {
      const remaining = prev.tabs.filter((tab) => tab.id !== id);
      const nextActive = prev.activeTabId === id ? remaining[remaining.length - 1].id : prev.activeTabId;
      return { tabs: remaining, activeTabId: nextActive };
    });
  }

  function updateTabSql(id: string, sql: string): void {
    setState((prev) => ({ ...prev, tabs: prev.tabs.map((tab) => (tab.id === id ? { ...tab, sql } : tab)) }));
  }

  function openLoadedTab(job: WarehouseJobDefinition, sql: string): void {
    const tab: QueryTab = {
      id: crypto.randomUUID(),
      label: job.job_name,
      sql,
      activeJobName: job.job_name,
      jobType: job.job_type,
    };
    setState((prev) => ({ tabs: [...prev.tabs, tab], activeTabId: tab.id }));
  }

  return { tabs, activeTabId, setActiveTabId, addTab, closeTab, updateTabSql, openLoadedTab };
}
