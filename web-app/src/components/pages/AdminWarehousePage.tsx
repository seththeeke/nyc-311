import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useWarehouseSchema } from "../../hooks/useWarehouseSchema";
import { useWarehouseJobRuns } from "../../hooks/useWarehouseJobRuns";
import { useWarehouseJobDefinitions } from "../../hooks/useWarehouseJobDefinitions";
import { useCreateWarehouseJob } from "../../hooks/useCreateWarehouseJob";
import { useUpdateWarehouseJob } from "../../hooks/useUpdateWarehouseJob";
import { useDeleteWarehouseJob } from "../../hooks/useDeleteWarehouseJob";
import { useJobSql } from "../../hooks/useJobSql";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import { CollapsiblePanel } from "../CollapsiblePanel";
import { WarehouseSchemaSearch } from "../data/WarehouseSchemaSearch";
import { SqlQueryConsole } from "../query/SqlQueryConsole";
import { JobDefinitionForm } from "../warehouseJobs/JobDefinitionForm";
import { WarehouseJobsPanel } from "../warehouseJobs/WarehouseJobsPanel";

/**
 * The admin-gated warehouse workspace (`7-data-warehousing.md` §12b) —
 * schema search and job management flank the query editor as
 * collapsible side panels, all visible at once, rather than tabs, so
 * neither needs a second tab open while writing a query. Loading a job
 * pulls its SQL into the editor (a fresh round trip — SQL text isn't
 * part of the job list response); saving from there updates that same
 * job instead of creating a new one.
 */
export function AdminWarehousePage(): ReactElement {
  const [schemaCollapsed, setSchemaCollapsed] = useState(false);
  const [jobsCollapsed, setJobsCollapsed] = useState(false);
  const [activeJob, setActiveJob] = useState<WarehouseJobDefinition | null>(null);
  const [loadedSql, setLoadedSql] = useState("");
  const [draftSql, setDraftSql] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState<string | null>(null);

  const schemaQuery = useWarehouseSchema();
  const jobRunsQuery = useWarehouseJobRuns();
  const jobDefinitionsQuery = useWarehouseJobDefinitions();
  const { createJob, isCreating, error: createError } = useCreateWarehouseJob();
  const { updateJob, isUpdating, error: updateError } = useUpdateWarehouseJob();
  const { deleteJob, isDeleting, error: deleteError } = useDeleteWarehouseJob();
  const { loadSql } = useJobSql();

  async function handleLoad(job: WarehouseJobDefinition): Promise<void> {
    setLoadingName(job.job_name);
    try {
      const sql = await loadSql(job.job_name);
      setActiveJob(job);
      setLoadedSql(sql);
      setDraftSql(null);
    } catch {
      /* useJobSql's own error state isn't surfaced here — the Load click just silently stays put; retrying is one more click away. */
    } finally {
      setLoadingName(null);
    }
  }

  async function handleUpdateJob(sql: string): Promise<void> {
    if (!activeJob) return;
    try {
      const updated = await updateJob(activeJob.job_name, activeJob.cadence_cron, sql);
      setActiveJob(updated);
      setLoadedSql(sql);
    } catch {
      /* updateError (from the hook's mutation state) already surfaces the failure inside SqlQueryConsole. */
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

        <div className="mt-6 flex items-start gap-4">
          <CollapsiblePanel title="Schema" collapsed={schemaCollapsed} onToggle={() => setSchemaCollapsed((c) => !c)}>
            {schemaQuery.isPending || schemaQuery.isError ? (
              <p className={schemaQuery.isError ? "text-red-400" : "text-slate-400"}>
                {schemaQuery.isError ? "Failed to load warehouse schema." : "Loading…"}
              </p>
            ) : (
              <WarehouseSchemaSearch tables={schemaQuery.data.tables} />
            )}
          </CollapsiblePanel>

          <div className="min-w-0 flex-1 space-y-4 rounded-2xl border border-white/10 bg-slate-950 p-6">
            {activeJob && (
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300">
                <span>
                  Editing job <span className="font-mono text-cyan-300">{activeJob.job_name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveJob(null);
                    setLoadedSql("");
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  Start a new query
                </button>
              </div>
            )}

            <SqlQueryConsole
              key={activeJob?.job_name ?? "new"}
              initialSql={loadedSql}
              activeJobName={activeJob?.job_name ?? null}
              onSaveAsJob={setDraftSql}
              onUpdateJob={activeJob ? (sql) => void handleUpdateJob(sql) : undefined}
              isUpdating={isUpdating}
              updateError={updateError}
            />

            {draftSql !== null && (
              <JobDefinitionForm
                initialSql={draftSql}
                onCreate={createJob}
                isCreating={isCreating}
                error={createError}
                onCreated={() => setDraftSql(null)}
                onCancel={() => setDraftSql(null)}
              />
            )}
          </div>

          <CollapsiblePanel
            title="Jobs"
            collapsed={jobsCollapsed}
            onToggle={() => setJobsCollapsed((c) => !c)}
            expandedClassName="w-96"
          >
            <WarehouseJobsPanel
              jobs={jobDefinitionsQuery.data ?? []}
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
      </main>
    </div>
  );
}
