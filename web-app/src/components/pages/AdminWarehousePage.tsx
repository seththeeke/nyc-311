import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useWarehouseSchema } from "../../hooks/useWarehouseSchema";
import { useWarehouseJobRuns } from "../../hooks/useWarehouseJobRuns";
import { useWarehouseJobDefinitions } from "../../hooks/useWarehouseJobDefinitions";
import { useCreateWarehouseJob } from "../../hooks/useCreateWarehouseJob";
import { useUpdateWarehouseJob } from "../../hooks/useUpdateWarehouseJob";
import { useDeleteWarehouseJob } from "../../hooks/useDeleteWarehouseJob";
import { useJobSql } from "../../hooks/useJobSql";
import { useQueryTabs } from "../../hooks/useQueryTabs";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import { CollapsiblePanel } from "../CollapsiblePanel";
import { WarehouseSchemaSearch } from "../data/WarehouseSchemaSearch";
import { SavedQueriesList } from "../data/SavedQueriesList";
import { QueryWorkspace } from "../query/QueryWorkspace";
import { WarehouseJobsPanel } from "../warehouseJobs/WarehouseJobsPanel";
import {
  AdminWarehouseViewTabs,
  adminWarehouseViewPanelId,
  adminWarehouseViewTabId,
  type AdminWarehouseView,
} from "../warehouseJobs/AdminWarehouseViewTabs";
import { JobRunResultView } from "../warehouseJobs/JobRunResultView";

type SchemaPanelView = "SCHEMA" | "SAVED_QUERIES";

const SCHEMA_TAB_CLASS = "rounded px-2.5 py-1 text-xs font-medium";

/**
 * The admin-gated warehouse workspace (`7-data-warehousing.md` §12b,
 * extended by the admin warehouse query-tabs enhancement) — a Schema/
 * Saved-queries toggle panel and a Jobs panel flank the multi-tab query
 * workspace. `useQueryTabs` owns the open tabs (persisted to
 * `localStorage`); loading a job or a saved query always opens a new tab
 * via `openLoadedTab`, seeded by a fresh SQL round trip (SQL text isn't
 * part of the job list response).
 */
export function AdminWarehousePage(): ReactElement {
  const [view, setView] = useState<AdminWarehouseView>("workspace");
  const [schemaCollapsed, setSchemaCollapsed] = useState(false);
  const [jobsCollapsed, setJobsCollapsed] = useState(false);
  const [schemaPanelView, setSchemaPanelView] = useState<SchemaPanelView>("SCHEMA");
  const [loadingName, setLoadingName] = useState<string | null>(null);

  const schemaQuery = useWarehouseSchema();
  const jobRunsQuery = useWarehouseJobRuns();
  const jobDefinitionsQuery = useWarehouseJobDefinitions();
  const { createJob, isCreating, error: createError } = useCreateWarehouseJob();
  const { updateJob, isUpdating, error: updateError } = useUpdateWarehouseJob();
  const { deleteJob, isDeleting, error: deleteError } = useDeleteWarehouseJob();
  const { loadSql } = useJobSql();
  const queryTabs = useQueryTabs();

  const jobDefinitions = jobDefinitionsQuery.data ?? [];
  const scheduledJobs = jobDefinitions.filter((job) => job.job_type === "SCHEDULED");
  const savedQueries = jobDefinitions.filter((job) => job.job_type === "SAVED_QUERY");

  async function handleLoad(job: WarehouseJobDefinition): Promise<void> {
    setLoadingName(job.job_name);
    try {
      const sql = await loadSql(job.job_name);
      queryTabs.openLoadedTab(job, sql);
    } catch {
      /* useJobSql's own error state isn't surfaced here — the Load click just silently stays put; retrying is one more click away. */
    } finally {
      setLoadingName(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora-1 absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full bg-emerald-600/30 blur-3xl" />
        <div className="animate-aurora-2 absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-600/30 blur-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="bg-grid-glow pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />

      <main className="relative mx-auto max-w-[100rem] px-6 py-16">
        <Link to="/admin" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">
          &larr; Admin
        </Link>
        <h1 className="mt-4 bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
          Warehouse
        </h1>
        <p className="mt-2 text-slate-400">Schema, ad-hoc queries, and self-service scheduled jobs, all in one place.</p>

        <div className="mt-6">
          <AdminWarehouseViewTabs view={view} onChange={setView} />
        </div>

        <div
          id={adminWarehouseViewPanelId(view)}
          role="tabpanel"
          aria-labelledby={adminWarehouseViewTabId(view)}
          className="mt-4"
        >
          {view === "reports" ? (
            <JobRunResultView jobRuns={jobRunsQuery.data?.jobRuns ?? []} />
          ) : (
            <div className="flex items-start gap-4">
              <CollapsiblePanel title="Schema" collapsed={schemaCollapsed} onToggle={() => setSchemaCollapsed((c) => !c)}>
                <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Schema panel view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={schemaPanelView === "SCHEMA"}
                    onClick={() => setSchemaPanelView("SCHEMA")}
                    className={`${SCHEMA_TAB_CLASS} ${schemaPanelView === "SCHEMA" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Schema
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={schemaPanelView === "SAVED_QUERIES"}
                    onClick={() => setSchemaPanelView("SAVED_QUERIES")}
                    className={`${SCHEMA_TAB_CLASS} ${schemaPanelView === "SAVED_QUERIES" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Saved queries
                  </button>
                </div>

                {schemaPanelView === "SCHEMA" ? (
                  schemaQuery.isPending || schemaQuery.isError ? (
                    <p className={schemaQuery.isError ? "text-red-400" : "text-slate-400"}>
                      {schemaQuery.isError ? "Failed to load warehouse schema." : "Loading…"}
                    </p>
                  ) : (
                    <WarehouseSchemaSearch tables={schemaQuery.data.tables} />
                  )
                ) : (
                  <SavedQueriesList
                    queries={savedQueries}
                    onDelete={deleteJob}
                    isDeleting={isDeleting}
                    deleteError={deleteError}
                    onLoad={(query) => void handleLoad(query)}
                    loadingName={loadingName}
                  />
                )}
              </CollapsiblePanel>

              <QueryWorkspace
                queryTabs={queryTabs}
                tables={schemaQuery.data?.tables}
                createJob={createJob}
                isCreating={isCreating}
                createError={createError}
                updateJob={updateJob}
                isUpdating={isUpdating}
                updateError={updateError}
              />

              <CollapsiblePanel
                title="Jobs"
                collapsed={jobsCollapsed}
                onToggle={() => setJobsCollapsed((c) => !c)}
                expandedClassName="w-96"
              >
                <WarehouseJobsPanel
                  jobs={scheduledJobs}
                  jobsLoading={jobDefinitionsQuery.isPending}
                  jobsError={jobDefinitionsQuery.isError}
                  jobRuns={jobRunsQuery.data?.jobRuns ?? []}
                  createJob={createJob}
                  isCreating={isCreating}
                  createError={createError}
                  deleteJob={deleteJob}
                  isDeleting={isDeleting}
                  deleteError={deleteError}
                  onLoad={(job) => void handleLoad(job)}
                  loadingName={loadingName}
                />
              </CollapsiblePanel>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
