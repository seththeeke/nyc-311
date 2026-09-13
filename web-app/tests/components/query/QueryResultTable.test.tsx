import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryResultTable } from "../../../src/components/query/QueryResultTable";
import type { AdHocQueryResult } from "../../../src/models/adHocQueryResult";

function result(overrides: Partial<AdHocQueryResult> = {}): AdHocQueryResult {
  return {
    columns: [
      { name: "label", type: "varchar" },
      { name: "n", type: "bigint" },
    ],
    rows: [
      { label: "a", n: "10" },
      { label: "b", n: "20" },
    ],
    row_count: 2,
    truncated: false,
    data_scanned_bytes: 100,
    engine_execution_time_ms: 50,
    ...overrides,
  };
}

describe("QueryResultTable", () => {
  it("renders a header from columns and one row per result row", () => {
    render(<QueryResultTable result={result()} />);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); /* header + 2 */
    expect(within(rows[0]).getByText("label")).toBeInTheDocument();
    expect(within(rows[0]).getByText("n")).toBeInTheDocument();
    expect(within(rows[1]).getByText("a")).toBeInTheDocument();
    expect(within(rows[1]).getByText("10")).toBeInTheDocument();
  });

  it("right-aligns numeric-typed columns", () => {
    render(<QueryResultTable result={result()} />);
    expect(screen.getByRole("columnheader", { name: "n" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "label" })).not.toHaveClass("text-right");
  });

  it("shows an empty-state message when there are no rows", () => {
    render(<QueryResultTable result={result({ rows: [] })} />);
    expect(screen.getByText("The query returned no rows.")).toBeInTheDocument();
  });

  it("renders an empty cell for a row missing a declared column", () => {
    render(<QueryResultTable result={result({ rows: [{ label: "only-label" }] })} />);
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("only-label");
    expect(cells[1]).toHaveTextContent("");
  });
});
