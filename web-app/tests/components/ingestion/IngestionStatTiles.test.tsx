import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IngestionStatTiles } from "../../../src/components/ingestion/IngestionStatTiles";
import type { PollerMetrics } from "../../../src/models/pollerMetrics";

// Most-recent-first, matching the real API's ordering.
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
    ran_at: "2026-08-15T12:00:00.000Z",
    success: true,
    records_ingested: 0,
    duplicates_skipped: 118,
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-15T19:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("IngestionStatTiles", () => {
  it("sums records ingested across every run", () => {
    render(<IngestionStatTiles metrics={metrics} />);
    expect(screen.getByText("2,042")).toBeInTheDocument();
  });

  it("computes the success rate as a percentage of runs", () => {
    render(<IngestionStatTiles metrics={metrics} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3 of 4 runs")).toBeInTheDocument();
  });

  it("shows the total run count", () => {
    render(<IngestionStatTiles metrics={metrics} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows the last run's relative time and status", () => {
    render(<IngestionStatTiles metrics={metrics} />);
    expect(screen.getByText("1 hour ago")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
  });

  it("shows Failed for a last run that didn't succeed", () => {
    const failedLast = [
      { ...metrics[2], ran_at: "2026-08-15T18:30:00.000Z" },
      ...metrics.slice(1),
    ];
    render(<IngestionStatTiles metrics={failedLast} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders without a sparkline for a single run", () => {
    const { container } = render(<IngestionStatTiles metrics={[metrics[0]]} />);
    expect(container.querySelector("polyline")).not.toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
