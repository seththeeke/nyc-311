import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarehouseJobsPanel } from "../../../src/components/warehouseJobs/WarehouseJobsPanel";
import type { WarehouseJobDefinition } from "../../../src/models/warehouseJobDefinition";

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

function baseProps() {
  return {
    jobs: [job],
    jobsLoading: false,
    jobsError: false,
    jobRuns: [],
    createJob: vi.fn(),
    isCreating: false,
    createError: null,
    deleteJob: vi.fn(),
    isDeleting: false,
    deleteError: null,
    onLoad: vi.fn(),
    loadingName: null,
  };
}

describe("WarehouseJobsPanel", () => {
  it("shows a loading state while jobs are pending", () => {
    render(<WarehouseJobsPanel {...baseProps()} jobsLoading={true} />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an error state when the jobs fetch fails", () => {
    render(<WarehouseJobsPanel {...baseProps()} jobsError={true} />);

    expect(screen.getByText("Failed to load jobs.")).toBeInTheDocument();
  });

  it("lists jobs and calls onLoad when a row's Load button is clicked", async () => {
    const onLoad = vi.fn();
    render(<WarehouseJobsPanel {...baseProps()} onLoad={onLoad} />);

    expect(screen.getByText("order_volume_by_zip")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Load job order_volume_by_zip" }));

    expect(onLoad).toHaveBeenCalledWith(job);
  });

  it("opens the New job form and creates a job", async () => {
    const createJob = vi.fn().mockResolvedValue(job);
    render(<WarehouseJobsPanel {...baseProps()} createJob={createJob} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "New job" }));
    await user.type(screen.getByLabelText("Job name"), "new_job");
    await user.type(screen.getByLabelText("SQL"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(createJob).toHaveBeenCalledWith("new_job", "SELECT 1", "cron(0 9 * * ? *)"));
    await waitFor(() => expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument());
  });

  it("cancels the New job form without creating anything", async () => {
    const createJob = vi.fn();
    render(<WarehouseJobsPanel {...baseProps()} createJob={createJob} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "New job" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument();
    expect(createJob).not.toHaveBeenCalled();
  });
});
