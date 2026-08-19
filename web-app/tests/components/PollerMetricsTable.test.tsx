import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PollerMetricsTable } from "../../src/components/PollerMetricsTable";
import type { PollerMetrics } from "../../src/models/pollerMetrics";

const successRun: PollerMetrics = {
  ran_at: "2026-08-15T15:12:43.894Z",
  success: true,
  records_ingested: 2000,
  duplicates_skipped: 3,
  records_rejected: 1,
  error_message: null,
};

const failedRun: PollerMetrics = {
  ran_at: "2026-08-15T06:00:00.000Z",
  success: false,
  records_ingested: 0,
  duplicates_skipped: 0,
  records_rejected: 0,
  error_message: "SODA API request timed out",
};

describe("PollerMetricsTable", () => {
  it("renders one row per metric with its counts", () => {
    render(<PollerMetricsTable metrics={[successRun]} />);

    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("2000")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows a Failed badge and the error message for a failed run", () => {
    render(<PollerMetricsTable metrics={[failedRun]} />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("SODA API request timed out")).toBeInTheDocument();
  });

  it("shows an em dash in the Error column for a successful run", () => {
    render(<PollerMetricsTable metrics={[successRun]} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a table row for every metric passed in", () => {
    render(<PollerMetricsTable metrics={[successRun, failedRun]} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); /* header + 2 data rows */
  });

  it("renders an empty table body when given no metrics", () => {
    render(<PollerMetricsTable metrics={[]} />);

    expect(screen.getAllByRole("row")).toHaveLength(1); /* header only */
  });
});
