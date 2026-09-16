import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryWorkspace } from "../../../src/components/query/QueryWorkspace";
import { useWarehouseQuery } from "../../../src/hooks/useWarehouseQuery";
import type { UseQueryTabsResult, QueryTab } from "../../../src/hooks/useQueryTabs";
import type { AdHocQueryResult } from "../../../src/models/adHocQueryResult";
import type { WarehouseJobDefinition } from "../../../src/models/warehouseJobDefinition";

vi.mock("../../../src/hooks/useWarehouseQuery", () => ({ useWarehouseQuery: vi.fn() }));
const mockedUseWarehouseQuery = vi.mocked(useWarehouseQuery);

const result: AdHocQueryResult = {
  columns: [{ name: "n", type: "bigint" }],
  rows: [{ n: "1" }],
  row_count: 1,
  truncated: false,
  data_scanned_bytes: 10,
  engine_execution_time_ms: 5,
};

const createdJob: WarehouseJobDefinition = {
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

function makeQueryTabs(tabs: QueryTab[], activeTabId: string, overrides: Partial<UseQueryTabsResult> = {}): UseQueryTabsResult {
  return {
    tabs,
    activeTabId,
    setActiveTabId: vi.fn(),
    addTab: vi.fn(),
    closeTab: vi.fn(),
    updateTabSql: vi.fn(),
    openLoadedTab: vi.fn(),
    ...overrides,
  };
}

function baseTabs(): QueryTab[] {
  return [
    { id: "tab-1", label: "Untitled query", sql: "", activeJobName: null, jobType: null },
    { id: "tab-2", label: "order_volume_by_zip", sql: "SELECT 2", activeJobName: "order_volume_by_zip", jobType: "SCHEDULED" },
  ];
}

describe("QueryWorkspace", () => {
  it("renders one SqlQueryConsole per tab", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });
    const queryTabs = makeQueryTabs(baseTabs(), "tab-1");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={vi.fn()}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );

    expect(screen.getAllByLabelText("SQL query")).toHaveLength(2);
  });

  it("shows only the active tab's console and hides the rest", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });
    const queryTabs = makeQueryTabs(baseTabs(), "tab-2");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={vi.fn()}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );

    const [firstConsole, secondConsole] = screen.getAllByLabelText("SQL query");
    expect(firstConsole.closest("[class*=hidden]")).not.toBeNull();
    expect(secondConsole.closest("[class*=hidden]")).toBeNull();
  });

  it("selecting a different tab in the tab bar calls setActiveTabId", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });
    const queryTabs = makeQueryTabs(baseTabs(), "tab-1");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={vi.fn()}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "order_volume_by_zip" }));

    expect(queryTabs.setActiveTabId).toHaveBeenCalledWith("tab-2");
  });

  it("typing in the active tab's console calls updateTabSql with that tab's id", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });
    const queryTabs = makeQueryTabs(baseTabs(), "tab-1");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={vi.fn()}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );

    await userEvent.setup().type(screen.getAllByLabelText("SQL query")[0], "1");

    expect(queryTabs.updateTabSql).toHaveBeenCalledWith("tab-1", "1");
  });

  it("Save as job opens a JobDefinitionForm scoped to that tab, and creating dismisses it", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const createJob = vi.fn().mockResolvedValue(createdJob);
    const queryTabs = makeQueryTabs(baseTabs(), "tab-1");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={createJob}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );
    const user = userEvent.setup();
    await user.type(screen.getAllByLabelText("SQL query")[0], "SELECT 1");
    await user.click(screen.getAllByRole("button", { name: "Save as job" })[0]);

    expect(screen.getByLabelText("Job name")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Job name"), "order_volume_by_zip");
    await user.click(screen.getByRole("button", { name: "Create job" }));

    await waitFor(() => expect(createJob).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument());
  });

  it("cancelling the Save as job form dismisses it without creating anything", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const createJob = vi.fn();
    const queryTabs = makeQueryTabs(baseTabs(), "tab-1");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={createJob}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Save as job" })[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Job name")).not.toBeInTheDocument();
    expect(createJob).not.toHaveBeenCalled();
  });

  it("cancelling the Save as query form dismisses it without creating anything", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const createJob = vi.fn();
    const queryTabs = makeQueryTabs(baseTabs(), "tab-1");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={createJob}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Save as query" })[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Query name")).not.toBeInTheDocument();
    expect(createJob).not.toHaveBeenCalled();
  });

  it("Save as query opens a SaveQueryForm and calls createJob with no cadenceCron", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const createJob = vi.fn().mockResolvedValue({ ...createdJob, job_type: "SAVED_QUERY" });
    const queryTabs = makeQueryTabs(baseTabs(), "tab-1");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={createJob}
        isCreating={false}
        createError={null}
        updateJob={vi.fn()}
        isUpdating={false}
        updateError={null}
      />
    );
    const user = userEvent.setup();
    await user.type(screen.getAllByLabelText("SQL query")[0], "SELECT 1");
    await user.click(screen.getAllByRole("button", { name: "Save as query" })[0]);
    await user.type(screen.getByLabelText("Query name"), "top_five_zips");
    await user.click(screen.getByRole("button", { name: "Save query" }));

    await waitFor(() => expect(createJob).toHaveBeenCalledWith("top_five_zips", "SELECT 1"));
  });

  it("Save to {job} calls updateJob with the active job's name and current sql", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const updateJob = vi.fn().mockResolvedValue(createdJob);
    const queryTabs = makeQueryTabs(baseTabs(), "tab-2");

    render(
      <QueryWorkspace
        queryTabs={queryTabs}
        createJob={vi.fn()}
        isCreating={false}
        createError={null}
        updateJob={updateJob}
        isUpdating={false}
        updateError={null}
      />
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Save to order_volume_by_zip" }));

    await waitFor(() => expect(updateJob).toHaveBeenCalledWith("order_volume_by_zip", "SELECT 2"));
    await waitFor(() => expect(queryTabs.updateTabSql).toHaveBeenCalledWith("tab-2", "SELECT 2"));
  });
});
