import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IngestionVolumeChart } from "../../../src/components/ingestion/IngestionVolumeChart";
import type { PollerMetrics } from "../../../src/models/pollerMetrics";

/*
 * Most-recent-first, matching the real API's ordering — chronologically
 * (oldest first, as the chart renders) this is: 2000/0/3, then the failed
 * run, then 42/5/0 last.
 */
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
  {
    ran_at: "2026-08-15T00:00:00.000Z",
    success: true,
    records_ingested: 2000,
    duplicates_skipped: 0,
    records_rejected: 3,
    error_message: null,
  },
];

describe("IngestionVolumeChart", () => {
  it("shows a legend entry for every series plus failed runs", () => {
    render(<IngestionVolumeChart metrics={metrics} />);
    expect(screen.getByText("Ingested")).toBeInTheDocument();
    expect(screen.getByText("Duplicates skipped")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Failed run")).toBeInTheDocument();
  });

  it("renders one hit-target per run, with a full breakdown in its accessible label", () => {
    render(<IngestionVolumeChart metrics={metrics} />);
    const buttons = screen.getAllByRole("button", { hidden: true });
    expect(buttons).toHaveLength(3);
    expect(screen.getByLabelText(/2000 ingested, 0 duplicates skipped, 3 rejected/)).toBeInTheDocument();
  });

  it("direct-labels only the most recent run's total, when it's non-zero", () => {
    render(<IngestionVolumeChart metrics={metrics} />);
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("marks a failed run with the critical-status color, not a stacked segment", () => {
    const { container } = render(<IngestionVolumeChart metrics={[metrics[1]]} />);
    const marker = container.querySelector('[style*="background-color: rgb(208, 59, 59)"]');
    expect(marker).toBeInTheDocument();
  });

  it("shows a bare 'Failed' tooltip line when a failed run has no error message", () => {
    const noMessage = [{ ...metrics[1], error_message: null }];
    render(<IngestionVolumeChart metrics={noMessage} />);
    expect(screen.getByText("Failed", { selector: "span.block" })).toBeInTheDocument();
  });

  it("omits the direct total label when the most recent run has zero records", () => {
    render(<IngestionVolumeChart metrics={[metrics[1]]} />);
    expect(screen.queryByText("0", { selector: "span.text-\\[10px\\]" })).not.toBeInTheDocument();
  });

  it("renders a date range caption from the oldest to the most recent run", () => {
    /*
     * Matched loosely (not against exact dates) — formatAbsoluteDateTime
     * renders in the test runner's local timezone, so a UTC-midnight
     * fixture can legitimately land on the previous local day.
     */
    render(<IngestionVolumeChart metrics={metrics} />);
    expect(screen.getByText(/^[A-Z][a-z]{2} \d{1,2} – [A-Z][a-z]{2} \d{1,2}$/)).toBeInTheDocument();
  });
});
