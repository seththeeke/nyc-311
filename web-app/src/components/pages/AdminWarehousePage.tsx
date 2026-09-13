import { useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useWarehouseSchema } from "../../hooks/useWarehouseSchema";
import { useWarehouseJobRuns } from "../../hooks/useWarehouseJobRuns";
import { useWarehouseJobDefinitions } from "../../hooks/useWarehouseJobDefinitions";
import { useCreateWarehouseJob } from "../../hooks/useCreateWarehouseJob";
import { useDeleteWarehouseJob } from "../../hooks/useDeleteWarehouseJob";
import type { WarehouseJobDefinition } from "../../models/warehouseJobDefinition";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { WarehouseSchemaView } from "../data/WarehouseSchemaView";
import { SqlQueryConsole } from "../query/SqlQueryConsole";
import { JobDefinitionForm } from "../warehouseJobs/JobDefinitionForm";
import { JobDefinitionList } from "../warehouseJobs/JobDefinitionList";

const ADMIN_WAREHOUSE_TABS = ["schema", "query", "jobs"] as const;
type AdminWarehouseTab = (typeof ADMIN_WAREHOUSE_TABS)[number];
const TAB_LABELS: Record<AdminWarehouseTab, string> = { schema: "Schema", query: "Query", jobs: "Jobs" };

/**
 * The admin-gated warehouse workspace (`7-data-warehousing.md` §12b, Leg
 * 8), replacing `AdminQueryPage` — schema reference, the ad-hoc SQL
 * console (with "Save as job"), and self-service job management, one
 * place so building a query and turning it into a schedule never needs a
 * second tab open elsewhere.
 */
export function AdminWarehousePage(): ReactElement {
  const [tab, setTab] = useState<AdminWarehouseTab>("query");
  const [draftSql, setDraftSql] = useState<string | null>(null);

  const schemaQuery = useWarehouseSchema();
  const jobRunsQuery = useWarehouseJobRuns();
  const jobDefinitionsQuery = useWarehouseJobDefinitions();
  const { createJob, isCreating, error: createError } = useCreateWarehouseJob();
  const { deleteJob, isDeleting, error: deleteError } = useDeleteWarehouseJob();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link to="/admin" className="text-sm text-slate-400 hover:text-slate-200">
        &larr; Admin
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Warehouse</h1>
      <p className="mt-1 text-slate-600">Schema reference, ad-hoc queries, and self-service scheduled jobs.</p>

      <div role="tablist" aria-label="Admin warehouse view" className="mt-6 flex border-b border-slate-700 text-sm">
        {ADMIN_WAREHOUSE_TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`admin-warehouse-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`admin-warehouse-panel-${value}`}
            onClick={() => setTab(value)}
            className={`relative px-4 py-2.5 font-medium ${
              tab === value
                ? "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-cyan-500"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </div>

      <div
        id={`admin-warehouse-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`admin-warehouse-tab-${tab}`}
        className="mt-6 rounded-2xl bg-slate-950 p-6"
      >
        {tab === "schema" &&
          (schemaQuery.isPending || schemaQuery.isError ? (
            <p className={schemaQuery.isError ? "text-red-400" : "text-slate-400"}>
              {schemaQuery.isError ? "Failed to load warehouse schema." : "Loading…"}
            </p>
          ) : (
            <div className="rounded-2xl bg-white p-4">
              <WarehouseSchemaView tables={schemaQuery.data.tables} />
            </div>
          ))}

        {tab === "query" && (
          <div className="space-y-4">
            <SqlQueryConsole onSaveAsJob={setDraftSql} />
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
        )}

        {tab === "jobs" && (
          <JobsTab
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
          />
        )}
      </div>
    </main>
  );
}

interface JobsTabProps {
  jobs: WarehouseJobDefinition[];
  jobsLoading: boolean;
  jobsError: boolean;
  jobRuns: WarehouseJobRun[];
  createJob: (name: string, cadenceCron: string, sql: string) => Promise<WarehouseJobDefinition>;
  isCreating: boolean;
  createError: Error | null;
  deleteJob: (name: string) => Promise<void>;
  isDeleting: boolean;
  deleteError: Error | null;
}

/** The Jobs tab's own body — a "New job" toggle, the list, and (when open) the create form. Kept out of the page component to stay under the 200-line component cap. */
function JobsTab({
  jobs,
  jobsLoading,
  jobsError,
  jobRuns,
  createJob,
  isCreating,
  createError,
  deleteJob,
  isDeleting,
  deleteError,
}: JobsTabProps): ReactElement {
  const [showNewJobForm, setShowNewJobForm] = useState(false);

  if (jobsLoading) return <p className="text-slate-400">Loading…</p>;
  if (jobsError) return <p className="text-red-400">Failed to load jobs.</p>;

  return (
    <div className="space-y-4">
      {showNewJobForm ? (
        <JobDefinitionForm
          onCreate={createJob}
          isCreating={isCreating}
          error={createError}
          onCreated={() => setShowNewJobForm(false)}
          onCancel={() => setShowNewJobForm(false)}
        />
      ) : (
        <button type="button" onClick={() => setShowNewJobForm(true)} className="rounded bg-emerald-600 px-4 py-2 text-white">
          New job
        </button>
      )}
      <JobDefinitionList
        jobs={jobs}
        jobRuns={jobRuns}
        onDelete={deleteJob}
        isDeleting={isDeleting}
        deleteError={deleteError}
      />
    </div>
  );
}
