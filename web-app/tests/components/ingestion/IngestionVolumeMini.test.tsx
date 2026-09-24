import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IngestionVolumeMini } from "../../../src/components/ingestion/IngestionVolumeMini";
import type { PollerMetrics } from "../../../src/models/pollerMetrics";

function run(overrides: Partial<PollerMetrics> = {}): PollerMetrics {
  return {
    ran_at: "2026-08-15T18:00:00.000Z",
    success: true,
    records_ingested: 40,
    duplicates_skipped: 10,
    records_rejected: 2,
    error_message: null,
    ...overrides,
  };
}

describe("IngestionVolumeMini", () => {
  it("draws one labelled bar per run, oldest to newest, with the numbers in its accessible name", () => {
    render(
      <IngestionVolumeMini
        metrics={[run({ ran_at: "2026-08-15T18:00:00.000Z", records_ingested: 5 }), run({ ran_at: "2026-08-15T12:00:00.000Z", records_ingested: 9 })]}
      />,
    );
    const bars = screen.getAllByRole("img");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAccessibleName(/9 ingested, 10 duplicates skipped, 2 rejected/);
    expect(bars[1]).toHaveAccessibleName(/5 ingested/);
  });

  it("shows only the most recent 24 runs and says so", () => {
    const many = Array.from({ length: 30 }, (_, i) => run({ ran_at: `2026-08-${String(30 - i).padStart(2, "0")}T00:00:00.000Z` }));
    render(<IngestionVolumeMini metrics={many} />);
    expect(screen.getAllByRole("img")).toHaveLength(24);
    expect(screen.getByText("last 24 runs")).toBeInTheDocument();
  });

  it("flags a failed run in its name and with a critical marker", () => {
    const { container } = render(
      <IngestionVolumeMini metrics={[run({ success: false, records_ingested: 0, duplicates_skipped: 0, records_rejected: 0, error_message: "boom" })]} />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/\(failed run\)/);
    expect(container.querySelector(".h-\\[2px\\]")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("data-tooltip", expect.stringContaining("failed"));
  });

  it("shows a small legend naming the ingested and duplicates series", () => {
    render(<IngestionVolumeMini metrics={[run()]} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Ingested", "Duplicates"]);
  });

  it("reports the peak on the axis and copes with all-zero runs", () => {
    render(<IngestionVolumeMini metrics={[run({ records_ingested: 0, duplicates_skipped: 0, records_rejected: 0 })]} />);
    expect(screen.getByText(/^peak/)).toBeInTheDocument();
  });
});
