import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataPage } from "../../../src/components/pages/DataPage";
import { warehouseDataService } from "../../../src/services/warehouseDataService";
import type { WarehouseSchemaResponse } from "../../../src/models/warehouseSchema";
import type { WarehouseJobRunListResponse } from "../../../src/models/warehouseJobRun";
import type { JobResult } from "../../../src/models/jobResult";

vi.mock("../../../src/services/warehouseDataService", () => ({
  warehouseDataService: { getSchema: vi.fn(), getJobRuns: vi.fn(), getJobResult: vi.fn() },
}));

const mockedGetSchema = vi.mocked(warehouseDataService.getSchema);
const mockedGetJobRuns = vi.mocked(warehouseDataService.getJobRuns);
const mockedGetJobResult = vi.mocked(warehouseDataService.getJobResult);

const emptySchema: WarehouseSchemaResponse = { tables: [] };

const jobResult: JobResult = {
  job_name: "order_volume_by_stage_7d",
  job_run_id: "01J8Z2SUCCEEDED000000000002",
  run_date: "2026-09-04",
  computed_at: "2026-09-04T09:00:14.000Z",
  columns: [
    { name: "created_date", type: "varchar" },
    { name: "stage", type: "varchar" },
    { name: "order_count", type: "bigint" },
  ],
  rows: [{ created_date: "2026-09-04", stage: "SCHEDULE", order_count: "412" }],
};

function jobRun(overrides: Partial<WarehouseJobRunListResponse["jobRuns"][number]>) {
  return {
    job_run_id: "01J8Z2SUCCEEDED000000000002",
    job_name: "order_volume_by_stage_7d",
    status: "SUCCEEDED" as const,
    trigger: "SCHEDULED" as const,
    started_at: "2026-09-04T09:00:01.000Z",
    completed_at: "2026-09-04T09:00:14.000Z",
    execution_ref: "6e1b9c22",
    result_location: "s3://b/k",
    row_count: 12,
    error_message: null,
    retry_count: 0,
    retried_from_job_run_id: null,
    data_scanned_bytes: 4_213_888,
    engine_execution_time_ms: 1_842,
    query_queue_time_ms: 96,
    ...overrides,
  };
}

const jobRuns: WarehouseJobRunListResponse = {
  jobRuns: [
    jobRun({ job_run_id: "a" }),
    jobRun({
      job_run_id: "b",
      status: "FAILED",
      error_message: "Athena query failed",
      result_location: null,
      row_count: null,
      data_scanned_bytes: null,
      engine_execution_time_ms: null,
      query_queue_time_ms: null,
    }),
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DataPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetSchema.mockReset();
  mockedGetJobRuns.mockReset();
  mockedGetJobResult.mockReset();
  mockedGetJobResult.mockResolvedValue({ ...jobResult, rows: [] });
});

describe("DataPage", () => {
  it("shows the heading and a link back home", () => {
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockResolvedValue({ jobRuns: [] });
    renderPage();

    expect(screen.getByRole("heading", { name: "Data" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
  });

  it("lays the schema and job columns out side by side", () => {
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockResolvedValue({ jobRuns: [] });
    const { container } = renderPage();

    const grid = container.querySelector("main > div.grid");
    expect(grid).toHaveClass("lg:grid-cols-5");
    expect(grid?.querySelector(".lg\\:col-span-2")).not.toBeNull();
    expect(grid?.querySelector(".lg\\:col-span-3")).not.toBeNull();
  });

  it("shows independent loading states for the schema and job-run sections", () => {
    mockedGetSchema.mockReturnValue(new Promise(() => {}));
    mockedGetJobRuns.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getAllByText("Loading…")).toHaveLength(2);
  });

  it("renders the warehouse schema once it resolves", async () => {
    mockedGetSchema.mockResolvedValue({ tables: [{ table_name: "order_events", columns: [] }] });
    mockedGetJobRuns.mockResolvedValue({ jobRuns: [] });
    renderPage();

    expect(await screen.findByText("order_events")).toBeInTheDocument();
  });

  it("shows an empty-state message when the catalog has no tables yet", async () => {
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockResolvedValue({ jobRuns: [] });
    renderPage();

    expect(await screen.findByText("No warehouse tables catalogued yet.")).toBeInTheDocument();
  });

  it("shows an error message when the schema fetch fails, independent of the job-runs panel", async () => {
    mockedGetSchema.mockRejectedValue(new Error("HTTP 500"));
    mockedGetJobRuns.mockResolvedValue({ jobRuns: [] });
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load warehouse schema: HTTP 500");
  });

  it("shows a generic error message for a non-Error schema rejection", async () => {
    mockedGetSchema.mockRejectedValue("boom");
    mockedGetJobRuns.mockResolvedValue({ jobRuns: [] });
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load warehouse schema.");
  });

  it("shows the Jobs tab selected by default, with the job filters in its panel", async () => {
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockResolvedValue(jobRuns);
    renderPage();

    expect(await screen.findAllByText("order_volume_by_stage_7d")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Jobs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("switches the right column to the Performance tab via the tab menu", async () => {
    const user = userEvent.setup();
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockResolvedValue(jobRuns);
    renderPage();

    await screen.findAllByText("order_volume_by_stage_7d");
    await user.click(screen.getByRole("tab", { name: "Performance" }));

    expect(screen.getByRole("tab", { name: "Performance" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(screen.getByText(/1 query run /)).toBeInTheDocument();
    expect(screen.getByText("4.0 MB")).toBeInTheDocument();
  });

  it("switches to the Results tab, rendering the job's latest resultset via its dedicated view", async () => {
    const user = userEvent.setup();
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockResolvedValue(jobRuns);
    mockedGetJobResult.mockResolvedValue(jobResult);
    renderPage();

    await screen.findAllByText("order_volume_by_stage_7d");
    await user.click(screen.getByRole("tab", { name: "Results" }));

    expect(screen.getByRole("tab", { name: "Results" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("columnheader", { name: "SCHEDULE" })).toBeInTheDocument();
    expect(mockedGetJobResult).toHaveBeenCalledWith("order_volume_by_stage_7d");
  });

  it("shows an error message when the job-result fetch fails, only on the Results tab", async () => {
    const user = userEvent.setup();
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockResolvedValue(jobRuns);
    mockedGetJobResult.mockRejectedValue(new Error("HTTP 404"));
    renderPage();

    await screen.findAllByText("order_volume_by_stage_7d");
    expect(screen.queryByText(/Failed to load result/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Results" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load result for order_volume_by_stage_7d: HTTP 404");
  });

  it("shows an error message when the job-runs fetch fails", async () => {
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockRejectedValue(new Error("HTTP 503"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load job runs: HTTP 503");
  });

  it("shows a generic error message for a non-Error job-runs rejection", async () => {
    mockedGetSchema.mockResolvedValue(emptySchema);
    mockedGetJobRuns.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load job runs.");
  });
});
