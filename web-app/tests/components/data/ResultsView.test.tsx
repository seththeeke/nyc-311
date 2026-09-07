import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsView } from "../../../src/components/data/ResultsView";
import type { JobResult } from "../../../src/models/jobResult";

function result(job_name: string, rows: Record<string, string>[]): JobResult {
  return {
    job_name,
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

describe("ResultsView", () => {
  it("dispatches order_volume_by_stage_7d to its dedicated matrix view", () => {
    render(
      <ResultsView
        result={result("order_volume_by_stage_7d", [
          { created_date: "2026-09-06", stage: "INGEST", order_count: "5" },
        ])}
      />
    );
    /* the matrix view has a stage column header; the generic table would show 'stage' as text but not as INGEST header */
    expect(screen.getByRole("columnheader", { name: "INGEST" })).toBeInTheDocument();
    expect(screen.getByText(/run 2026-09-07/)).toBeInTheDocument();
  });

  it("falls back to a generic table for an unregistered job", () => {
    render(
      <ResultsView result={result("some_new_job", [{ created_date: "x", stage: "y", order_count: "1" }])} />
    );
    expect(screen.getByRole("columnheader", { name: "created_date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "order_count" })).toBeInTheDocument();
  });
});
