import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobDefinitionList } from "../../../src/components/warehouseJobs/JobDefinitionList";
import type { WarehouseJobDefinition } from "../../../src/models/warehouseJobDefinition";
import type { WarehouseJobRun } from "../../../src/models/warehouseJobRun";

const jobA: WarehouseJobDefinition = {
  job_run_id: "DEF#job_a",
  record_type: "DEFINITION",
  job_name: "job_a",
  sql_s3_key: "job-definitions/job_a.sql",
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-job_a-Test",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

const jobB: WarehouseJobDefinition = { ...jobA, job_run_id: "DEF#job_b", job_name: "job_b", schedule_name: "Nyc311WarehouseJob-job_b-Test" };

const runForA: WarehouseJobRun = {
  job_run_id: "01RUN00000000000000000001",
  job_name: "job_a",
  status: "SUCCEEDED",
  trigger: "SCHEDULED",
  started_at: "2026-09-13T09:00:00.000Z",
  completed_at: "2026-09-13T09:00:05.000Z",
  execution_ref: "exec-1",
  result_location: "s3://bucket/result.json",
  row_count: 3,
  error_message: null,
  retry_count: 0,
  retried_from_job_run_id: null,
  data_scanned_bytes: 100,
  engine_execution_time_ms: 50,
  query_queue_time_ms: 5,
};

describe("JobDefinitionList", () => {
  it("shows a placeholder when there are no jobs", () => {
    render(<JobDefinitionList jobs={[]} jobRuns={[]} onDelete={vi.fn()} isDeleting={false} deleteError={null} />);

    expect(screen.getByText(/No jobs yet/)).toBeInTheDocument();
  });

  it("renders one row per job, with its cadence and creator", () => {
    render(<JobDefinitionList jobs={[jobA, jobB]} jobRuns={[]} onDelete={vi.fn()} isDeleting={false} deleteError={null} />);

    expect(screen.getByText("job_a")).toBeInTheDocument();
    expect(screen.getByText("job_b")).toBeInTheDocument();
    expect(screen.getAllByText("Daily at 09:00 UTC")).toHaveLength(2);
  });

  it("toggles the run history for a job, scoped to that job_name", async () => {
    render(<JobDefinitionList jobs={[jobA, jobB]} jobRuns={[runForA]} onDelete={vi.fn()} isDeleting={false} deleteError={null} />);
    const user = userEvent.setup();

    const rowA = screen.getByText("job_a").closest("tr");
    expect(rowA).not.toBeNull();
    await user.click(within(rowA as HTMLElement).getByRole("button", { name: "History" }));

    expect(screen.getByRole("button", { name: "Hide history" })).toBeInTheDocument();
    expect(screen.getByText("5s")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide history" }));
    expect(screen.queryByRole("button", { name: "Hide history" })).not.toBeInTheDocument();
  });

  it("requires confirmation before deleting, and calls onDelete on confirm", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<JobDefinitionList jobs={[jobA]} jobRuns={[]} onDelete={onDelete} isDeleting={false} deleteError={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete job job_a" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete job_a?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("job_a"));
  });

  it("cancels the delete confirmation without calling onDelete", async () => {
    const onDelete = vi.fn();
    render(<JobDefinitionList jobs={[jobA]} jobRuns={[]} onDelete={onDelete} isDeleting={false} deleteError={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete job job_a" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete job_a?")).not.toBeInTheDocument();
  });

  it("does not throw out of the confirm handler when onDelete rejects", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("boom"));
    render(<JobDefinitionList jobs={[jobA]} jobRuns={[]} onDelete={onDelete} isDeleting={false} deleteError={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete job job_a" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
  });

  it("disables Confirm and relabels it while deleting", async () => {
    render(<JobDefinitionList jobs={[jobA]} jobRuns={[]} onDelete={vi.fn()} isDeleting={true} deleteError={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete job job_a" }));

    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });

  it("shows the delete error message when present", () => {
    render(
      <JobDefinitionList jobs={[jobA]} jobRuns={[]} onDelete={vi.fn()} isDeleting={false} deleteError={new Error("boom")} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });
});
