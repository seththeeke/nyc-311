import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SqlQueryConsole } from "../../../src/components/query/SqlQueryConsole";
import { useWarehouseQuery } from "../../../src/hooks/useWarehouseQuery";
import type { AdHocQueryResult } from "../../../src/models/adHocQueryResult";

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
});
