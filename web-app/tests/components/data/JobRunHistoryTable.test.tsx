import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobRunHistoryTable } from "../../../src/components/data/JobRunHistoryTable";
import type { WarehouseJobRun } from "../../../src/models/warehouseJobRun";

const succeeded: WarehouseJobRun = {
  job_run_id: "01J8Z2SUCCEEDED000000000002",
  job_name: "ORDER_VOLUME_BY_BOROUGH",
  status: "SUCCEEDED",
  trigger: "SCHEDULED",
  started_at: "2026-09-04T09:00:01.000Z",
  completed_at: "2026-09-04T09:00:14.000Z",
  execution_ref: "6e1b9c22-7a4f-4e8d-9b2a-1c5d8e3f7a90",
  error_message: null,
  retry_count: 0,
  retried_from_job_run_id: null,
  data_scanned_bytes: 4_213_888,
  engine_execution_time_ms: 1_842,
  query_queue_time_ms: 96,
};

const exhaustedRetry: WarehouseJobRun = {
  job_run_id: "01J8Y8REBUILDR300000000008",
  job_name: "REBUILD_REQUESTS",
  status: "FAILED",
  trigger: "RETRY",
  started_at: "2026-09-01T22:40:00.000Z",
  completed_at: "2026-09-01T22:41:18.000Z",
  execution_ref: "arn:aws:states:us-east-1:178280182163:execution:Nyc311WarehouseRebuild-Test:7f1d90",
  error_message: "ExportTableToPointInTime failed: PointInTimeRecoveryUnavailableException",
  retry_count: 3,
  retried_from_job_run_id: "01J8Y7REBUILDR200000000007",
  data_scanned_bytes: null,
  engine_execution_time_ms: null,
  query_queue_time_ms: null,
};

describe("JobRunHistoryTable", () => {
  it("renders one condensed row per run: job name, status, trigger, started, duration", () => {
    render(<JobRunHistoryTable jobRuns={[succeeded]} />);

    expect(screen.getByText("ORDER_VOLUME_BY_BOROUGH")).toBeInTheDocument();
    expect(screen.getByText("SCHEDULED")).toBeInTheDocument();
    expect(screen.getByText("13s")).toBeInTheDocument();
  });

  it("keeps the status label for screen readers and a hover tooltip, not visibly duplicated next to the icon", () => {
    render(<JobRunHistoryTable jobRuns={[succeeded]} />);

    expect(screen.getByText("Succeeded")).toHaveClass("sr-only");
    expect(screen.getByText("Succeeded").parentElement).toHaveAttribute("title", "Succeeded");
  });

  it("does not show detail-only fields (run ID, execution ref, error, query stats) until expanded", () => {
    render(<JobRunHistoryTable jobRuns={[succeeded]} />);

    expect(screen.queryByText(succeeded.job_run_id)).not.toBeInTheDocument();
    expect(screen.queryByText(/scanned/)).not.toBeInTheDocument();
  });

  it("expands a row to reveal run ID, execution ref, and query performance", async () => {
    const user = userEvent.setup();
    render(<JobRunHistoryTable jobRuns={[succeeded]} />);

    await user.click(screen.getByRole("button", { name: "Show run details" }));

    expect(screen.getByText(succeeded.job_run_id)).toBeInTheDocument();
    expect(screen.getByText(succeeded.execution_ref as string)).toBeInTheDocument();
    expect(screen.getByText(/4\.0 MB scanned/)).toBeInTheDocument();
    expect(screen.getByText(/1\.84s engine time/)).toBeInTheDocument();
  });

  it("collapses an expanded row when toggled again", async () => {
    const user = userEvent.setup();
    render(<JobRunHistoryTable jobRuns={[succeeded]} />);

    await user.click(screen.getByRole("button", { name: "Show run details" }));
    await user.click(screen.getByRole("button", { name: "Hide run details" }));

    expect(screen.queryByText(succeeded.job_run_id)).not.toBeInTheDocument();
  });

  it("shows the retry chain and a retries-exhausted note once retry_count reaches MAX_JOB_RETRIES", async () => {
    const user = userEvent.setup();
    render(<JobRunHistoryTable jobRuns={[exhaustedRetry]} />);

    await user.click(screen.getByRole("button", { name: "Show run details" }));

    expect(screen.getByText(/retry of 01J8Y7RE/)).toBeInTheDocument();
    expect(screen.getByText(/retries exhausted \(max 3\)/)).toBeInTheDocument();
    expect(screen.getByText(exhaustedRetry.error_message as string)).toBeInTheDocument();
  });

  it("shows an em dash for a null execution_ref, and doesn't truncate a short retried_from_job_run_id", async () => {
    const user = userEvent.setup();
    const noExecutionRef: WarehouseJobRun = {
      ...exhaustedRetry,
      job_run_id: "run-2",
      execution_ref: null,
      retried_from_job_run_id: "short1",
    };
    render(<JobRunHistoryTable jobRuns={[noExecutionRef]} />);

    await user.click(screen.getByRole("button", { name: "Show run details" }));

    expect(screen.getByText("—", { selector: "dd.break-all" })).toBeInTheDocument();
    expect(screen.getByText(/retry of short1,/)).toBeInTheDocument();
  });

  it("shows an em dash for query performance fields that are null", async () => {
    const user = userEvent.setup();
    render(<JobRunHistoryTable jobRuns={[exhaustedRetry]} />);

    await user.click(screen.getByRole("button", { name: "Show run details" }));

    expect(screen.getByText(/— scanned/)).toBeInTheDocument();
  });

  it("expands each row independently", async () => {
    const user = userEvent.setup();
    render(<JobRunHistoryTable jobRuns={[succeeded, exhaustedRetry]} />);

    const toggles = screen.getAllByRole("button", { name: "Show run details" });
    await user.click(toggles[0]);

    expect(screen.getByRole("button", { name: "Hide run details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show run details" })).toBeInTheDocument();
  });

  it("renders a table row for every run", () => {
    render(<JobRunHistoryTable jobRuns={[succeeded, exhaustedRetry]} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); /* header + 2 condensed data rows */
  });
});
