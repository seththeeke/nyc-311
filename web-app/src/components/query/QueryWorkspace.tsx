import { useState, type ReactElement } from "react";
import type { UseQueryTabsResult } from "../../hooks/useQueryTabs";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import type { WarehouseTable } from "../../models/warehouseSchema";
import { JobDefinitionForm } from "../warehouseJobs/JobDefinitionForm";
import { SaveQueryForm } from "../warehouseJobs/SaveQueryForm";
import { QueryTabBar } from "./QueryTabBar";
import { SqlQueryConsole } from "./SqlQueryConsole";

export interface QueryWorkspaceProps {
  queryTabs: UseQueryTabsResult;
  tables?: WarehouseTable[];
  createJob: (name: string, sql: string, cadenceCron?: string) => Promise<WarehouseJobDefinition>;
  isCreating: boolean;
  createError: Error | null;
  updateJob: (name: string, sql: string, cadenceCron?: string) => Promise<WarehouseJobDefinition>;
  isUpdating: boolean;
  updateError: Error | null;
}

interface SaveDraft {
  tabId: string;
  sql: string;
  kind: "JOB" | "QUERY";
}

/**
 * The center query-editor column (admin warehouse query-tabs enhancement)
 * — a tab bar plus one `SqlQueryConsole` per open tab, all kept mounted
 * (hidden via CSS rather than unmounted) so switching tabs never loses a
 * result or in-progress autocomplete state within the session. Owns the
 * "Save as job"/"Save as query" draft forms, scoped to whichever tab
 * triggered them.
 */
export function QueryWorkspace({
  queryTabs,
  tables,
  createJob,
  isCreating,
  createError,
  updateJob,
  isUpdating,
  updateError,
}: QueryWorkspaceProps): ReactElement {
  const { tabs, activeTabId, setActiveTabId, addTab, closeTab, updateTabSql } = queryTabs;
  const [draft, setDraft] = useState<SaveDraft | null>(null);

  async function handleUpdateJob(tabId: string, activeJobName: string, sql: string): Promise<void> {
    try {
      await updateJob(activeJobName, sql);
      updateTabSql(tabId, sql);
    } catch {
      /* updateError (from the caller's mutation state) already surfaces the failure inside SqlQueryConsole. */
    }
  }

  return (
    <div className="min-w-0 flex-1 space-y-4 rounded-2xl border border-line bg-surface p-6">
      <QueryTabBar tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTabId} onClose={closeTab} onAdd={addTab} />
      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === activeTabId ? "space-y-4" : "hidden"}>
          <SqlQueryConsole
            initialSql={tab.sql}
            activeJobName={tab.activeJobName}
            tables={tables}
            onSqlChange={(sql) => updateTabSql(tab.id, sql)}
            onSaveAsJob={(sql) => setDraft({ tabId: tab.id, sql, kind: "JOB" })}
            onSaveAsQuery={(sql) => setDraft({ tabId: tab.id, sql, kind: "QUERY" })}
            onUpdateJob={tab.activeJobName ? (sql) => void handleUpdateJob(tab.id, tab.activeJobName as string, sql) : undefined}
            isUpdating={isUpdating}
            updateError={updateError}
          />

          {draft?.tabId === tab.id && draft.kind === "JOB" && (
            <JobDefinitionForm
              initialSql={draft.sql}
              onCreate={createJob}
              isCreating={isCreating}
              error={createError}
              onCreated={() => setDraft(null)}
              onCancel={() => setDraft(null)}
            />
          )}
          {draft?.tabId === tab.id && draft.kind === "QUERY" && (
            <SaveQueryForm
              initialSql={draft.sql}
              onCreate={(name, sql) => createJob(name, sql)}
              isCreating={isCreating}
              error={createError}
              onCreated={() => setDraft(null)}
              onCancel={() => setDraft(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
