import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunHistoryStrip } from "../../../src/components/ingestion/RunHistoryStrip";
import type { PollerMetrics } from "../../../src/models/pollerMetrics";

const metrics: PollerMetrics[] = [
  {
    ran_at: "2026-08-15T18:00:00.000Z",
    success: true,
    records_ingested: 42,
    duplicates_skipped: 5,
    records_rejected: 0,
    error_message: null,
  },
  {
    ran_at: "2026-08-15T06:00:00.000Z",
    success: false,
    records_ingested: 0,
    duplicates_skipped: 0,
    records_rejected: 0,
    error_message: "SODA API request timed out",
  },
];

describe("RunHistoryStrip", () => {
  it("renders one block per run", () => {
    render(<RunHistoryStrip metrics={metrics} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("summarizes a successful run in its accessible label", () => {
    render(<RunHistoryStrip metrics={metrics} />);
    expect(screen.getByLabelText(/succeeded, 42 ingested, 5 duplicates skipped/)).toBeInTheDocument();
  });

  it("summarizes a failed run with its error message in its accessible label", () => {
    render(<RunHistoryStrip metrics={metrics} />);
    expect(screen.getByLabelText(/failed — SODA API request timed out/)).toBeInTheDocument();
  });

  it("summarizes a failed run with no error message", () => {
    const noMessage = [{ ...metrics[1], error_message: null }];
    render(<RunHistoryStrip metrics={noMessage} />);
    expect(screen.getByLabelText(/: failed$/)).toBeInTheDocument();
  });

  it("shows a legend for both statuses", () => {
    render(<RunHistoryStrip metrics={metrics} />);
    // Each status word also appears inside its (hidden-by-default) hover
    // tooltip, so two matches is expected: the tooltip and the legend.
    expect(screen.getAllByText("Succeeded")).toHaveLength(2);
    expect(screen.getAllByText("Failed")).toHaveLength(2);
  });
});
