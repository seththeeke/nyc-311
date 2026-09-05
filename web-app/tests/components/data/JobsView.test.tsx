import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobsView } from "../../../src/components/data/JobsView";
import type { WarehouseJobRun } from "../../../src/models/warehouseJobRun";

function run(overrides: Partial<WarehouseJobRun>): WarehouseJobRun {
  return {
    job_run_id: "run-1",
    job_name: "ORDER_VOLUME_BY_BOROUGH",
    status: "SUCCEEDED",
    trigger: "SCHEDULED",
    started_at: "2026-09-04T09:00:01.000Z",
    completed_at: "2026-09-04T09:00:14.000Z",
    execution_ref: "ref",
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: null,
    engine_execution_time_ms: null,
    query_queue_time_ms: null,
    ...overrides,
  };
}

const jobRuns: WarehouseJobRun[] = [
  run({ job_run_id: "a", status: "SUCCEEDED" }),
  run({ job_run_id: "b", status: "FAILED", job_name: "REBUILD_REQUESTS", trigger: "MANUAL" }),
];

describe("JobsView", () => {
  it("renders filters and a row per run by default", () => {
    render(<JobsView jobRuns={jobRuns} />);

    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); /* header + 2 rows */
  });

  it("filters by status", async () => {
    render(<JobsView jobRuns={jobRuns} />);

    await userEvent.selectOptions(screen.getByLabelText("Status"), "FAILED");

    expect(screen.getAllByRole("row")).toHaveLength(2); /* header + 1 row */
  });

  it("filters by trigger", async () => {
    render(<JobsView jobRuns={jobRuns} />);

    await userEvent.selectOptions(screen.getByLabelText("Trigger"), "MANUAL");

    expect(screen.getByText("REBUILD_REQUESTS")).toBeInTheDocument();
    expect(screen.queryByText("ORDER_VOLUME_BY_BOROUGH")).not.toBeInTheDocument();
  });

  it("filters by job name, case-insensitively", async () => {
    render(<JobsView jobRuns={jobRuns} />);

    await userEvent.type(screen.getByLabelText("Job name"), "rebuild");

    expect(screen.getByText("REBUILD_REQUESTS")).toBeInTheDocument();
  });

  it("shows an empty-state message when nothing matches the filters", async () => {
    render(<JobsView jobRuns={jobRuns} />);

    await userEvent.type(screen.getByLabelText("Job name"), "NO_SUCH_JOB");

    expect(screen.getByText("No job runs match these filters.")).toBeInTheDocument();
  });
});
