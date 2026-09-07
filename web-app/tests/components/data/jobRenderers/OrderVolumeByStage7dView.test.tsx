import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OrderVolumeByStage7dView } from "../../../../src/components/data/jobRenderers/OrderVolumeByStage7dView";
import type { JobResult } from "../../../../src/models/jobResult";

function cell(created_date: string, stage: string, order_count: number): Record<string, string> {
  return { created_date, stage, order_count: String(order_count) };
}

function result(rows: Record<string, string>[]): JobResult {
  return {
    job_name: "order_volume_by_stage_7d",
    job_run_id: "01RUN",
    run_date: "2026-09-07",
    computed_at: "2026-09-07T14:16:36.410Z",
    columns: [
      { name: "created_date", type: "varchar" },
      { name: "stage", type: "varchar" },
      { name: "order_count", type: "bigint" },
    ],
    rows,
  };
}

describe("OrderVolumeByStage7dView", () => {
  it("pivots rows into a created-date × stage matrix with per-date and per-stage totals", () => {
    render(
      <OrderVolumeByStage7dView
        result={result([
          cell("2026-09-06", "INGEST", 100),
          cell("2026-09-06", "SCHEDULE", 200),
          cell("2026-09-07", "SCHEDULE", 50),
        ])}
      />
    );

    /* header: Created | INGEST | SCHEDULE | Total */
    expect(screen.getByRole("columnheader", { name: "INGEST" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "SCHEDULE" })).toBeInTheDocument();

    const dateRow = screen.getByRole("row", { name: /2026-09-06/ });
    expect(within(dateRow).getByText("100")).toBeInTheDocument();
    expect(within(dateRow).getByText("200")).toBeInTheDocument();
    expect(within(dateRow).getByText("300")).toBeInTheDocument(); /* date total */

    const rows = screen.getAllByRole("row");
    const totalRow = rows[rows.length - 1]; /* the footer totals row */
    expect(within(totalRow).getByRole("rowheader", { name: "Total" })).toBeInTheDocument();
    expect(within(totalRow).getByText("100")).toBeInTheDocument(); /* INGEST column total */
    expect(within(totalRow).getByText("250")).toBeInTheDocument(); /* SCHEDULE column total */
    expect(within(totalRow).getByText("350")).toBeInTheDocument(); /* grand total */
  });

  it("renders a dash for a (date, stage) pair with no rows", () => {
    render(
      <OrderVolumeByStage7dView
        result={result([cell("2026-09-06", "INGEST", 5), cell("2026-09-07", "SCHEDULE", 8)])}
      />
    );
    const row = screen.getByRole("row", { name: /2026-09-06/ });
    expect(within(row).getByText("–")).toBeInTheDocument();
  });

  it("names the job and run date", () => {
    render(<OrderVolumeByStage7dView result={result([cell("2026-09-06", "INGEST", 1)])} />);
    expect(screen.getByText(/order_volume_by_stage_7d/)).toBeInTheDocument();
    expect(screen.getByText(/run 2026-09-07/)).toBeInTheDocument();
  });

  it("shows an empty state when the resultset has no rows", () => {
    render(<OrderVolumeByStage7dView result={result([])} />);
    expect(screen.getByText("No orders in the trailing 7 days yet.")).toBeInTheDocument();
  });

  it("tolerates a row missing created_date / stage / order_count", () => {
    render(
      <OrderVolumeByStage7dView
        result={result([
          { stage: "INGEST", order_count: "3" } /* no created_date -> "" bucket */,
          { created_date: "2026-09-06" } /* no stage/order_count -> "" stage, 0 count */,
        ])}
      />
    );
    /* renders without throwing; the "" created-date row exists */
    expect(screen.getAllByRole("row").length).toBeGreaterThan(2);
  });
});
