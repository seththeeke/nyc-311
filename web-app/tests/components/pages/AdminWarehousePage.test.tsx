import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminWarehousePage } from "../../../src/components/pages/AdminWarehousePage";
import { warehouseDataService } from "../../../src/services/warehouseDataService";
import { warehouseJobDefinitionService } from "../../../src/services/warehouseJobDefinitionService";
import { warehouseQueryService } from "../../../src/services/warehouseQueryService";
import type { WarehouseSchemaResponse } from "../../../src/models/warehouseSchema";
import type { WarehouseJobDefinition } from "../../../src/models/warehouseJobDefinition";
import type { AdHocQueryResult } from "../../../src/models/adHocQueryResult";

vi.mock("../../../src/services/warehouseDataService", () => ({
  warehouseDataService: { getSchema: vi.fn(), getJobRuns: vi.fn(), getJobResult: vi.fn() },
}));
vi.mock("../../../src/services/warehouseJobDefinitionService", () => ({
  warehouseJobDefinitionService: {
    listJobs: vi.fn(),
    createJob: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    getJobSql: vi.fn(),
  },
}));
vi.mock("../../../src/services/warehouseQueryService", () => ({
  warehouseQueryService: { runQuery: vi.fn() },
}));

const mockedGetSchema = vi.mocked(warehouseDataService.getSchema);
const mockedGetJobRuns = vi.mocked(warehouseDataService.getJobRuns);
const mockedListJobs = vi.mocked(warehouseJobDefinitionService.listJobs);
const mockedCreateJob = vi.mocked(warehouseJobDefinitionService.createJob);
const mockedUpdateJob = vi.mocked(warehouseJobDefinitionService.updateJob);
const mockedDeleteJob = vi.mocked(warehouseJobDefinitionService.deleteJob);
const mockedGetJobSql = vi.mocked(warehouseJobDefinitionService.getJobSql);
const mockedRunQuery = vi.mocked(warehouseQueryService.runQuery);

const emptySchema: WarehouseSchemaResponse = { tables: [] };

const job: WarehouseJobDefinition = {
  job_run_id: "DEF#order_volume_by_zip",
  record_type: "DEFINITION",
  job_name: "order_volume_by_zip",
  sql_s3_key: "job-definitions/order_volume_by_zip.sql",
  cadence_cron: "cron(0 9 * * ? *)",
  schedule_name: "Nyc311WarehouseJob-order_volume_by_zip-Test",
  created_at: "2026-09-13T19:04:11.000Z",
  created_by: "01ADMIN0000000000000000001",
};

const queryResult: AdHocQueryResult = {
  columns: [{ name: "n", type: "bigint" }],
  rows: [{ n: "1" }],
  row_count: 1,
  truncated: false,
  data_scanned_bytes: 10,
  engine_execution_time_ms: 5,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminWarehousePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedGetSchema.mockReset().mockResolvedValue(emptySchema);
  mockedGetJobRuns.mockReset().mockResolvedValue({ jobRuns: [] });
  mockedListJobs.mockReset().mockResolvedValue([job]);
  mockedCreateJob.mockReset();
  mockedUpdateJob.mockReset();
  mockedDeleteJob.mockReset();
  mockedGetJobSql.mockReset();
  mockedRunQuery.mockReset();
});

describe("AdminWarehousePage", () => {
  it("shows the heading and a link back to Admin", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Warehouse" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
  });

  it("shows the schema, query editor, and jobs panels all at once", async () => {
    mockedGetSchema.mockResolvedValue({ tables: [{ table_name: "order_events", columns: [] }] });
    renderPage();

    expect(await screen.findByText("order_events")).toBeInTheDocument();
    expect(screen.getByLabelText("SQL query")).toBeInTheDocument();
    expect(await screen.findByText("order_volume_by_zip")).toBeInTheDocument();
  });

  it("shows a loading state on the schema panel while the fetch is pending", async () => {
    mockedGetSchema.mockReturnValue(new Promise(() => {}));
    renderPage();
    await screen.findByText("order_volume_by_zip");

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an error message on the schema panel when the fetch fails", async () => {
    mockedGetSchema.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    expect(await screen.findByText("Failed to load warehouse schema.")).toBeInTheDocument();
  });

  it("collapses and re-expands the Schema panel", async () => {
    mockedGetSchema.mockResolvedValue({ tables: [{ table_name: "order_events", columns: [] }] });
    renderPage();
    await screen.findByText("order_events");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Hide Schema" }));
    expect(screen.queryByText("order_events")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show Schema" }));
    expect(await screen.findByText("order_events")).toBeInTheDocument();
  });

  it("runs a query, then Save as job opens a pre-filled create form", async () => {
    mockedRunQuery.mockResolvedValue(queryResult);
    mockedCreateJob.mockResolvedValue(job);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SQL query"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByText(/1 row/);
    await user.click(screen.getByRole("button", { name: "Save as job" }));

    expect(screen.getByLabelText("SQL")).toHaveValue("SELECT 1");

    await user.type(screen.getByLabelText("Job name"), "order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(mockedCreateJob).toHaveBeenCalledWith("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1"));
    await waitFor(() => expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument());
  });

  it("loads a job's SQL into the editor and shows the active-job badge", async () => {
    mockedGetJobSql.mockResolvedValue("SELECT borough FROM locations");
    renderPage();
    await screen.findByText("order_volume_by_zip");

    await userEvent.setup().click(screen.getByRole("button", { name: "Load" }));

    expect(mockedGetJobSql).toHaveBeenCalledWith("order_volume_by_zip");
    await waitFor(() => expect(screen.getByLabelText("SQL query")).toHaveValue("SELECT borough FROM locations"));
    expect(screen.getAllByText("order_volume_by_zip").length).toBeGreaterThan(1);
  });

  it("saves changes back to the loaded job instead of creating a new one", async () => {
    mockedGetJobSql.mockResolvedValue("SELECT 1");
    mockedRunQuery.mockResolvedValue(queryResult);
    mockedUpdateJob.mockResolvedValue({ ...job, cadence_cron: "cron(0 9 * * ? *)" });
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(screen.getByLabelText("SQL query")).toHaveValue("SELECT 1"));

    await user.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByText(/1 row/);
    await user.click(screen.getByRole("button", { name: "Save to order_volume_by_zip" }));

    await waitFor(() =>
      expect(mockedUpdateJob).toHaveBeenCalledWith("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1")
    );
  });

  it("does not throw when updateJob rejects, and surfaces the failure", async () => {
    mockedGetJobSql.mockResolvedValue("SELECT 1");
    mockedRunQuery.mockResolvedValue(queryResult);
    mockedUpdateJob.mockRejectedValue(new Error("schedule update failed"));
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(screen.getByLabelText("SQL query")).toHaveValue("SELECT 1"));

    await user.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByText(/1 row/);
    await user.click(screen.getByRole("button", { name: "Save to order_volume_by_zip" }));

    await waitFor(() => expect(mockedUpdateJob).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("schedule update failed");
  });

  it("clears the active job via 'Start a new query'", async () => {
    mockedGetJobSql.mockResolvedValue("SELECT 1");
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Load" }));
    await waitFor(() => expect(screen.getByLabelText("SQL query")).toHaveValue("SELECT 1"));

    await user.click(screen.getByRole("button", { name: "Start a new query" }));

    expect(screen.getByLabelText("SQL query")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Start a new query" })).not.toBeInTheDocument();
  });

  it("creates a job from the Jobs panel's New job form", async () => {
    mockedCreateJob.mockResolvedValue({ ...job, job_name: "new_job" });
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "New job" }));
    await user.type(screen.getByLabelText("Job name"), "new_job");
    await user.type(screen.getByLabelText("SQL"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(mockedCreateJob).toHaveBeenCalledWith("new_job", "cron(0 9 * * ? *)", "SELECT 1"));
  });

  it("deletes a job from the Jobs panel", async () => {
    mockedDeleteJob.mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Delete job order_volume_by_zip" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mockedDeleteJob).toHaveBeenCalledWith("order_volume_by_zip"));
  });

  it("collapses and re-expands the Jobs panel", async () => {
    renderPage();
    await screen.findByText("order_volume_by_zip");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Hide Jobs" }));
    expect(screen.queryByText("order_volume_by_zip")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show Jobs" }));
    expect(await screen.findByText("order_volume_by_zip")).toBeInTheDocument();
  });
});
