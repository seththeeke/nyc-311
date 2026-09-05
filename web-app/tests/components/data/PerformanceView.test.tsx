import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceView } from "../../../src/components/data/PerformanceView";
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

const queryRun = run({
  job_run_id: "q1",
  data_scanned_bytes: 4_213_888,
  engine_execution_time_ms: 1_842,
  query_queue_time_ms: 96,
});

const secondQueryRun = run({
  job_run_id: "q2",
  data_scanned_bytes: 2_097_152,
  engine_execution_time_ms: 1_000,
  query_queue_time_ms: 200,
});

const rebuildRun = run({ job_run_id: "r1", job_name: "REBUILD_REQUESTS", trigger: "MANUAL" });

describe("PerformanceView", () => {
  it("shows an empty-state message when no run carries execution metrics", () => {
    render(<PerformanceView jobRuns={[rebuildRun]} />);

    expect(screen.getByText("No completed query runs with execution metrics yet.")).toBeInTheDocument();
  });

  it("lists only runs that carry execution metrics, with the formatted stats", () => {
    render(<PerformanceView jobRuns={[queryRun, rebuildRun]} />);

    expect(screen.getAllByRole("row")).toHaveLength(2); /* header + 1 query run, rebuild excluded */
    expect(screen.getByText("4.0 MB")).toBeInTheDocument();
    expect(screen.getByText("1.84s")).toBeInTheDocument();
    expect(screen.getByText("96 ms")).toBeInTheDocument();
  });

  it("summarizes the run count and averages", () => {
    render(<PerformanceView jobRuns={[queryRun, secondQueryRun]} />);

    expect(screen.getByText(/2 query runs/)).toBeInTheDocument();
    expect(screen.getByText(/avg engine time 1\.42s/)).toBeInTheDocument();
    expect(screen.getByText(/avg scanned 3\.0 MB/)).toBeInTheDocument();
  });

  it("uses the singular 'run' for exactly one query run", () => {
    render(<PerformanceView jobRuns={[queryRun]} />);

    expect(screen.getByText(/1 query run /)).toBeInTheDocument();
  });
});
