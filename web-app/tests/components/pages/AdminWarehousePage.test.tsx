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
  warehouseJobDefinitionService: { listJobs: vi.fn(), createJob: vi.fn(), deleteJob: vi.fn() },
}));
vi.mock("../../../src/services/warehouseQueryService", () => ({
  warehouseQueryService: { runQuery: vi.fn() },
}));

const mockedGetSchema = vi.mocked(warehouseDataService.getSchema);
const mockedGetJobRuns = vi.mocked(warehouseDataService.getJobRuns);
const mockedListJobs = vi.mocked(warehouseJobDefinitionService.listJobs);
const mockedCreateJob = vi.mocked(warehouseJobDefinitionService.createJob);
const mockedDeleteJob = vi.mocked(warehouseJobDefinitionService.deleteJob);
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
  mockedDeleteJob.mockReset();
  mockedRunQuery.mockReset();
});

describe("AdminWarehousePage", () => {
  it("shows the heading and a link back to Admin", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Warehouse" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
  });

  it("defaults to the Query tab", () => {
    renderPage();

    expect(screen.getByRole("tab", { name: "Query" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("SQL query")).toBeInTheDocument();
  });

  it("switches to the Schema tab and renders the warehouse schema once it resolves", async () => {
    mockedGetSchema.mockResolvedValue({ tables: [{ table_name: "order_events", columns: [] }] });
    renderPage();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Schema" }));

    expect(await screen.findByText("order_events")).toBeInTheDocument();
  });

  it("shows a loading state on the Schema tab while the fetch is pending", async () => {
    mockedGetSchema.mockReturnValue(new Promise(() => {}));
    renderPage();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Schema" }));

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an error message on the Schema tab when the fetch fails", async () => {
    mockedGetSchema.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Schema" }));

    expect(await screen.findByText("Failed to load warehouse schema.")).toBeInTheDocument();
  });

  it("runs a query, then Save as job opens a pre-filled create form", async () => {
    mockedRunQuery.mockResolvedValue(queryResult);
    mockedCreateJob.mockResolvedValue(job);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SQL query"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Save as job" }));

    expect(screen.getByLabelText("SQL")).toHaveValue("SELECT 1");

    await user.type(screen.getByLabelText("Job name"), "order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(mockedCreateJob).toHaveBeenCalledWith("order_volume_by_zip", "cron(0 9 * * ? *)", "SELECT 1"));
    await waitFor(() => expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument());
  });

  it("Cancel on the Save as job form closes it without creating anything", async () => {
    mockedRunQuery.mockResolvedValue(queryResult);
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("SQL query"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Save as job" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument();
    expect(mockedCreateJob).not.toHaveBeenCalled();
  });

  it("switches to the Jobs tab, listing existing jobs and creating a new one via the New job form", async () => {
    mockedCreateJob.mockResolvedValue({ ...job, job_name: "new_job" });
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "Jobs" }));
    expect(await screen.findByText("order_volume_by_zip")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New job" }));
    await user.type(screen.getByLabelText("Job name"), "new_job");
    await user.type(screen.getByLabelText("SQL"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(mockedCreateJob).toHaveBeenCalledWith("new_job", "cron(0 9 * * ? *)", "SELECT 1"));
    await waitFor(() => expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument());
  });

  it("shows a loading state on the Jobs tab while the list fetch is pending", async () => {
    mockedListJobs.mockReturnValue(new Promise(() => {}));
    renderPage();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Jobs" }));

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the Jobs tab with an empty run history while job runs are still loading", async () => {
    mockedGetJobRuns.mockReturnValue(new Promise(() => {}));
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "Jobs" }));
    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "History" }));

    expect(screen.getByRole("button", { name: "Hide history" })).toBeInTheDocument();
  });

  it("Cancel on the New job form closes it without creating anything", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "Jobs" }));
    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "New job" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument();
    expect(mockedCreateJob).not.toHaveBeenCalled();
  });

  it("shows an error message on the Jobs tab when the list fetch fails", async () => {
    mockedListJobs.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Jobs" }));

    expect(await screen.findByText("Failed to load jobs.")).toBeInTheDocument();
  });

  it("deletes a job from the Jobs tab", async () => {
    mockedDeleteJob.mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "Jobs" }));
    await screen.findByText("order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Delete job order_volume_by_zip" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mockedDeleteJob).toHaveBeenCalledWith("order_volume_by_zip"));
  });
});
