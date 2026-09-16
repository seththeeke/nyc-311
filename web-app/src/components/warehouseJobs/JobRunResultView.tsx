import { useState, type ReactElement } from "react";
import type { WarehouseJobRun } from "../../models/warehouseJobRun";
import { useJobRunResults } from "../../hooks/useJobRunResults";
import { WarehouseJobRunPicker } from "./WarehouseJobRunPicker";
import { GenericResultTable } from "../data/GenericResultTable";

export interface JobRunResultViewProps {
  jobRuns: WarehouseJobRun[];
}

/**
 * The admin Reports tab's content (`7-data-warehousing.md` §12b's
 * addition) — pick any historical job run and see its raw result,
 * straight off S3, via the existing `GenericResultTable`. Calls
 * {@link useJobRunResults} with a one-element array; the hook/service/
 * endpoint underneath are already bulk-capable for a future multi-select
 * dashboard, but this iteration keeps single-run selection.
 */
export function JobRunResultView({ jobRuns }: JobRunResultViewProps): ReactElement {
  const [selectedJobRunId, setSelectedJobRunId] = useState<string | null>(null);
  const { loadResults, results, isLoading, error } = useJobRunResults();

  async function handleSelect(jobRunId: string): Promise<void> {
    setSelectedJobRunId(jobRunId);
    try {
      await loadResults([jobRunId]);
    } catch {
      /* the hook's own error state is surfaced below; nothing further to do here. */
    }
  }

  const selectedItem = results.find((item) => item.job_run_id === selectedJobRunId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">Job runs</h2>
        <WarehouseJobRunPicker
          jobRuns={jobRuns}
          selectedJobRunId={selectedJobRunId}
          onSelect={(jobRunId) => void handleSelect(jobRunId)}
        />
      </div>
      <div className="lg:col-span-3">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-300 uppercase">Result</h2>
        {selectedJobRunId === null ? (
          <p className="text-sm text-slate-400">Select a job run to see its raw result.</p>
        ) : isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-400">
            Failed to load result{error instanceof Error ? `: ${error.message}` : "."}
          </p>
        ) : selectedItem?.error ? (
          <p role="alert" className="text-sm text-red-400">
            {selectedItem.error}
          </p>
        ) : selectedItem?.result ? (
          <div className="rounded-2xl bg-white p-4">
            <GenericResultTable result={selectedItem.result} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
