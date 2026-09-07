import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GenericResultTable } from "../../../src/components/data/GenericResultTable";
import type { JobResult } from "../../../src/models/jobResult";

function result(overrides: Partial<JobResult> = {}): JobResult {
  return {
    job_name: "some_job",
    job_run_id: "01RUN",
    run_date: "2026-09-07",
    computed_at: "2026-09-07T14:16:36.410Z",
    columns: [
      { name: "label", type: "varchar" },
      { name: "n", type: "bigint" },
    ],
    rows: [
      { label: "a", n: "10" },
      { label: "b", n: "20" },
    ],
    ...overrides,
  };
}

describe("GenericResultTable", () => {
  it("renders a header from columns and one row per result row", () => {
    render(<GenericResultTable result={result()} />);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3); /* header + 2 */
    expect(within(rows[0]).getByText("label")).toBeInTheDocument();
    expect(within(rows[0]).getByText("n")).toBeInTheDocument();
    expect(within(rows[1]).getByText("a")).toBeInTheDocument();
    expect(within(rows[1]).getByText("10")).toBeInTheDocument();
  });

  it("right-aligns numeric-typed columns", () => {
    render(<GenericResultTable result={result()} />);
    expect(screen.getByRole("columnheader", { name: "n" })).toHaveClass("text-right");
    expect(screen.getByRole("columnheader", { name: "label" })).not.toHaveClass("text-right");
  });

  it("shows an empty-state message when there are no rows", () => {
    render(<GenericResultTable result={result({ rows: [] })} />);
    expect(screen.getByText("The latest run returned no rows.")).toBeInTheDocument();
  });

  it("renders an empty cell for a row missing a declared column", () => {
    render(<GenericResultTable result={result({ rows: [{ label: "only-label" }] })} />);
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("only-label");
    expect(cells[1]).toHaveTextContent("");
  });
});
