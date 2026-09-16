import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SqlQueryConsole } from "../../../src/components/query/SqlQueryConsole";
import { useWarehouseQuery } from "../../../src/hooks/useWarehouseQuery";
import type { AdHocQueryResult } from "../../../src/models/adHocQueryResult";
import type { WarehouseTable } from "../../../src/models/warehouseSchema";

const locations: WarehouseTable = {
  table_name: "locations",
  columns: [{ name: "borough", type: "string", comment: null }],
};

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

describe("SqlQueryConsole", () => {
  it("disables the Run button until the textarea has non-whitespace text", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole />);
    const runButton = screen.getByRole("button", { name: "Run query" });
    expect(runButton).toBeDisabled();

    await userEvent.setup().type(screen.getByLabelText("SQL query"), "SELECT 1");
    expect(runButton).toBeEnabled();
  });

  it("calls runQuery with the textarea's contents when clicked", async () => {
    const runQuery = vi.fn().mockResolvedValue(result);
    mockedUseWarehouseQuery.mockReturnValue({ runQuery, result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Run query" }));

    await waitFor(() => expect(runQuery).toHaveBeenCalledWith("SELECT 1"));
  });

  it("disables and relabels the button while running", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: true, error: null });

    render(<SqlQueryConsole />);

    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
  });

  it("shows the error message when present, and not the result", () => {
    mockedUseWarehouseQuery.mockReturnValue({
      runQuery: vi.fn(),
      result,
      isRunning: false,
      error: new Error("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed"),
    });

    render(<SqlQueryConsole />);

    expect(screen.getByRole("alert")).toHaveTextContent("Only SELECT/WITH/SHOW/DESCRIBE/EXPLAIN statements are allowed");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the result table with row count once a query succeeds", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });

    render(<SqlQueryConsole />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/1 row/)).toBeInTheDocument();
    expect(screen.getByText(/5ms/)).toBeInTheDocument();
  });

  it("notes truncation when the result was capped at 500 rows", () => {
    mockedUseWarehouseQuery.mockReturnValue({
      runQuery: vi.fn(),
      result: { ...result, row_count: 500, truncated: true },
      isRunning: false,
      error: null,
    });

    render(<SqlQueryConsole />);

    expect(screen.getByText(/truncated at 500/)).toBeInTheDocument();
  });

  it("does not throw out of handleRun when runQuery rejects", async () => {
    const runQuery = vi.fn().mockRejectedValue(new Error("bad request"));
    mockedUseWarehouseQuery.mockReturnValue({ runQuery, result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Run query" }));

    await waitFor(() => expect(runQuery).toHaveBeenCalled());
  });

  it("does not call runQuery when the textarea is only whitespace", async () => {
    const runQuery = vi.fn();
    mockedUseWarehouseQuery.mockReturnValue({ runQuery, result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "   ");
    expect(screen.getByRole("button", { name: "Run query" })).toBeDisabled();
  });

  it("does not render a Save as job control when onSaveAsJob is omitted", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });

    render(<SqlQueryConsole />);

    expect(screen.queryByRole("button", { name: "Save as job" })).not.toBeInTheDocument();
  });

  it("calls onSaveAsJob with the current SQL text when clicked", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const onSaveAsJob = vi.fn();

    render(<SqlQueryConsole onSaveAsJob={onSaveAsJob} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Save as job" }));

    expect(onSaveAsJob).toHaveBeenCalledWith("SELECT 1");
  });

  it("does not render a Save as query control when onSaveAsQuery is omitted", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });

    render(<SqlQueryConsole />);

    expect(screen.queryByRole("button", { name: "Save as query" })).not.toBeInTheDocument();
  });

  it("calls onSaveAsQuery with the current SQL text when clicked", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const onSaveAsQuery = vi.fn();

    render(<SqlQueryConsole onSaveAsQuery={onSaveAsQuery} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "SELECT 1");
    await user.click(screen.getByRole("button", { name: "Save as query" }));

    expect(onSaveAsQuery).toHaveBeenCalledWith("SELECT 1");
  });

  it("calls onSqlChange with each keystroke's current value", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });
    const onSqlChange = vi.fn();

    render(<SqlQueryConsole onSqlChange={onSqlChange} />);
    await userEvent.setup().type(screen.getByLabelText("SQL query"), "hi");

    expect(onSqlChange).toHaveBeenCalledWith("h");
    expect(onSqlChange).toHaveBeenCalledWith("hi");
  });

  it("pre-fills the textarea from initialSql", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole initialSql="SELECT * FROM locations" />);

    expect(screen.getByLabelText("SQL query")).toHaveValue("SELECT * FROM locations");
  });

  it("shows the active job name badge when activeJobName is set", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole activeJobName="order_volume_by_zip" />);

    expect(screen.getByText("order_volume_by_zip")).toBeInTheDocument();
  });

  it("does not render a Save-to-job control when activeJobName is set but onUpdateJob is omitted", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });

    render(<SqlQueryConsole activeJobName="order_volume_by_zip" />);

    expect(screen.queryByRole("button", { name: /save to/i })).not.toBeInTheDocument();
  });

  it("calls onUpdateJob with the current SQL text when the Save-to-job button is clicked", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });
    const onUpdateJob = vi.fn();

    render(<SqlQueryConsole activeJobName="order_volume_by_zip" onUpdateJob={onUpdateJob} initialSql="SELECT 2" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save to order_volume_by_zip" }));

    expect(onUpdateJob).toHaveBeenCalledWith("SELECT 2");
  });

  it("disables and relabels the Save-to-job button while updating, and shows the update error", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result, isRunning: false, error: null });

    render(
      <SqlQueryConsole
        activeJobName="order_volume_by_zip"
        onUpdateJob={vi.fn()}
        isUpdating={true}
        updateError={new Error("schedule update failed")}
      />
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("schedule update failed");
  });

  it("shows schema-aware suggestions as the schema-fed textarea is typed into", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole tables={[locations]} />);
    await userEvent.setup().type(screen.getByLabelText("SQL query"), "SELECT * FROM loc");

    expect(screen.getByRole("option", { name: "locations" })).toBeInTheDocument();
  });

  it("does not show a suggestion menu when nothing matches", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole tables={[locations]} />);
    await userEvent.setup().type(screen.getByLabelText("SQL query"), "SELECT ");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects a suggestion by clicking it, inserting it into the textarea", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole tables={[locations]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "SELECT * FROM loc");
    await user.click(screen.getByRole("option", { name: "locations" }));

    expect(screen.getByLabelText("SQL query")).toHaveValue("SELECT * FROM locations ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("calls onSqlChange when a suggestion is applied via click, not just via typing", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });
    const onSqlChange = vi.fn();

    render(<SqlQueryConsole tables={[locations]} onSqlChange={onSqlChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "SELECT * FROM loc");
    onSqlChange.mockClear();
    await user.click(screen.getByRole("option", { name: "locations" }));

    expect(onSqlChange).toHaveBeenCalledWith("SELECT * FROM locations ");
  });

  it("selects a suggestion with Enter", async () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    render(<SqlQueryConsole tables={[locations]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("SQL query"), "SELECT * FROM loc");
    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("SQL query")).toHaveValue("SELECT * FROM locations ");
  });
});
