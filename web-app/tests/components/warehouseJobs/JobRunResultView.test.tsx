import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobRunResultView } from "../../../src/components/warehouseJobs/JobRunResultView";
import { useJobRunResults } from "../../../src/hooks/useJobRunResults";
import type { WarehouseJobRun } from "../../../src/models/warehouseJobRun";
import type { JobRunResultItem } from "../../../src/models/jobRunResults";

vi.mock("../../../src/hooks/useJobRunResults", () => ({ useJobRunResults: vi.fn() }));

const mockedUseJobRunResults = vi.mocked(useJobRunResults);

function jobRun(overrides: Partial<WarehouseJobRun> = {}): WarehouseJobRun {
  return {
    job_run_id: "01SUCCEEDED",
    job_name: "order_volume_by_stage_7d",
    status: "SUCCEEDED",
    trigger: "SCHEDULED",
    started_at: "2026-09-04T09:00:01.000Z",
    completed_at: "2026-09-04T09:00:14.000Z",
    execution_ref: "ref",
    result_location: "s3://bucket/job-results/job_name=order_volume_by_stage_7d/run_date=2026-09-04/result.json",
    row_count: 4,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: null,
    engine_execution_time_ms: null,
    query_queue_time_ms: null,
    ...overrides,
  };
}

const RESULT_ITEM: JobRunResultItem = {
  job_run_id: "01SUCCEEDED",
  result: {
    job_name: "order_volume_by_stage_7d",
    job_run_id: "01SUCCEEDED",
    run_date: "2026-09-04",
    computed_at: "2026-09-04T09:00:14.000Z",
    columns: [{ name: "stage", type: "varchar" }],
    rows: [{ stage: "SCHEDULE" }],
  },
  error: null,
};

function mockHook(overrides: Partial<ReturnType<typeof useJobRunResults>> = {}): ReturnType<typeof useJobRunResults> {
  const base: ReturnType<typeof useJobRunResults> = {
    loadResults: vi.fn().mockResolvedValue([]),
    results: [],
    isLoading: false,
    error: null,
  };
  return { ...base, ...overrides };
}

describe("JobRunResultView", () => {
  it("renders the run picker with the given job runs", () => {
    mockedUseJobRunResults.mockReturnValue(mockHook());
    render(
      <JobRunResultView
        jobRuns={[jobRun(), jobRun({ job_run_id: "01RUNNING", job_name: "top_zips", status: "RUNNING", result_location: null })]}
      />
    );

    expect(screen.getByText("order_volume_by_stage_7d")).toBeInTheDocument();
    expect(screen.getByText("top_zips")).toBeInTheDocument();
    expect(screen.getByText("Select a job run to see its raw result.")).toBeInTheDocument();
  });

  it("disables a RUNNING run's row so it can't be selected", () => {
    mockedUseJobRunResults.mockReturnValue(mockHook());
    render(<JobRunResultView jobRuns={[jobRun({ job_run_id: "01RUNNING", status: "RUNNING", result_location: null })]} />);

    expect(screen.getByRole("button", { name: /order_volume_by_stage_7d/ })).toBeDisabled();
  });

  it("disables a FAILED run's row so it can't be selected", () => {
    mockedUseJobRunResults.mockReturnValue(mockHook());
    render(<JobRunResultView jobRuns={[jobRun({ job_run_id: "01FAILED", status: "FAILED", result_location: null })]} />);

    expect(screen.getByRole("button", { name: /order_volume_by_stage_7d/ })).toBeDisabled();
  });

  it("selecting a SUCCEEDED run loads and renders its raw result via GenericResultTable", async () => {
    const loadResults = vi.fn().mockResolvedValue([RESULT_ITEM]);
    mockedUseJobRunResults.mockReturnValue(mockHook({ loadResults, results: [RESULT_ITEM] }));
    const user = userEvent.setup();

    render(<JobRunResultView jobRuns={[jobRun()]} />);
    await user.click(screen.getByRole("button", { name: /order_volume_by_stage_7d/ }));

    expect(loadResults).toHaveBeenCalledWith(["01SUCCEEDED"]);
    expect(screen.getByText("stage")).toBeInTheDocument();
    expect(screen.getByText("SCHEDULE")).toBeInTheDocument();
  });

  it("shows a loading state while the result is being fetched", async () => {
    mockedUseJobRunResults.mockReturnValue(mockHook({ isLoading: true }));
    const user = userEvent.setup();

    render(<JobRunResultView jobRuns={[jobRun()]} />);
    await user.click(screen.getByRole("button", { name: /order_volume_by_stage_7d/ }));

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows the hook's error when the request itself fails", async () => {
    mockedUseJobRunResults.mockReturnValue(mockHook({ error: new Error("network down") }));
    const user = userEvent.setup();

    render(<JobRunResultView jobRuns={[jobRun()]} />);
    await user.click(screen.getByRole("button", { name: /order_volume_by_stage_7d/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });

  it("shows a per-item error instead of a table when the item has no result", async () => {
    const item: JobRunResultItem = { job_run_id: "01SUCCEEDED", result: null, error: "No result for this job run" };
    mockedUseJobRunResults.mockReturnValue(mockHook({ results: [item] }));
    const user = userEvent.setup();

    render(<JobRunResultView jobRuns={[jobRun()]} />);
    await user.click(screen.getByRole("button", { name: /order_volume_by_stage_7d/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("No result for this job run");
  });

  it("renders a message when there are no job runs", () => {
    mockedUseJobRunResults.mockReturnValue(mockHook());
    render(<JobRunResultView jobRuns={[]} />);

    expect(screen.getByText("No job runs yet.")).toBeInTheDocument();
  });

  it("does not throw when loadResults itself rejects — the hook's own error state is what's surfaced", async () => {
    const loadResults = vi.fn().mockRejectedValue(new Error("boom"));
    mockedUseJobRunResults.mockReturnValue(mockHook({ loadResults }));
    const user = userEvent.setup();

    render(<JobRunResultView jobRuns={[jobRun()]} />);
    await user.click(screen.getByRole("button", { name: /order_volume_by_stage_7d/ }));

    expect(loadResults).toHaveBeenCalledWith(["01SUCCEEDED"]);
  });

  it("renders nothing in the result panel once a run is selected but no matching item, error, or loading state exists yet", async () => {
    mockedUseJobRunResults.mockReturnValue(mockHook());
    const user = userEvent.setup();

    render(<JobRunResultView jobRuns={[jobRun()]} />);
    await user.click(screen.getByRole("button", { name: /order_volume_by_stage_7d/ }));

    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
