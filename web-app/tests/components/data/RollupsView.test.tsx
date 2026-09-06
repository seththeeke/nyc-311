import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RollupsView } from "../../../src/components/data/RollupsView";
import type { AnalyticsRollup } from "../../../src/models/analyticsRollup";

function rollup(overrides: Partial<AnalyticsRollup>): AnalyticsRollup {
  return {
    metric_view: "ORDER_VOLUME_BY_STAGE",
    rollup_key: "2026-09-04#SCHEDULE",
    run_date: "2026-09-04",
    dimension: "SCHEDULE",
    value: 100,
    computed_at: "2026-09-04T09:00:14.000Z",
    job_run_id: "run-1",
    ...overrides,
  };
}

const latestRun = [
  rollup({ rollup_key: "2026-09-04#SCHEDULE", dimension: "SCHEDULE", value: 412 }),
  rollup({ rollup_key: "2026-09-04#CLOSED", dimension: "CLOSED", value: 1904 }),
];
const earlierRun = [
  rollup({ rollup_key: "2026-09-03#SCHEDULE", run_date: "2026-09-03", dimension: "SCHEDULE", value: 389 }),
];

describe("RollupsView", () => {
  it("shows an empty state when no rollups exist", () => {
    render(<RollupsView rollups={[]} />);
    expect(screen.getByText(/No rollups computed yet/)).toBeInTheDocument();
  });

  it("renders the latest run's dimensions sorted by descending value, with a total row", () => {
    render(<RollupsView rollups={[...earlierRun, ...latestRun]} />);

    const rows = screen.getAllByRole("row");
    /* header + 2 dimensions + total */
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("CLOSED")).toBeInTheDocument();
    expect(within(rows[2]).getByText("SCHEDULE")).toBeInTheDocument();
    expect(within(rows[3]).getByText("2,316")).toBeInTheDocument();
  });

  it("names the metric view and the latest run date", () => {
    render(<RollupsView rollups={latestRun} />);
    expect(screen.getByText(/ORDER_VOLUME_BY_STAGE/)).toBeInTheDocument();
    expect(screen.getByText(/latest run 2026-09-04/)).toBeInTheDocument();
  });

  it("lists earlier runs with their totals when more than one run_date is present", () => {
    render(<RollupsView rollups={[...earlierRun, ...latestRun]} />);

    expect(screen.getByText("Earlier runs")).toBeInTheDocument();
    expect(screen.getByText("2026-09-03")).toBeInTheDocument();
    expect(screen.getByText("389 across 1 dimension")).toBeInTheDocument();
  });

  it("omits the earlier-runs section when there is only one run_date", () => {
    render(<RollupsView rollups={latestRun} />);
    expect(screen.queryByText("Earlier runs")).not.toBeInTheDocument();
  });

  it("uses the newest computed_at in a run and pluralizes the earlier-run dimension count", () => {
    render(
      <RollupsView
        rollups={[
          rollup({ rollup_key: "2026-09-05#A", run_date: "2026-09-05", dimension: "A", value: 1, computed_at: "2026-09-05T09:00:01.000Z" }),
          rollup({ rollup_key: "2026-09-05#B", run_date: "2026-09-05", dimension: "B", value: 2, computed_at: "2026-09-05T09:00:20.000Z" }),
          rollup({ rollup_key: "2026-09-04#A", run_date: "2026-09-04", dimension: "A", value: 3 }),
          rollup({ rollup_key: "2026-09-04#B", run_date: "2026-09-04", dimension: "B", value: 4 }),
        ]}
      />
    );

    expect(screen.getByText(/7 across 2 dimensions/)).toBeInTheDocument();
    /* the latest run's header line shows the newest computed_at of its rows */
    const newest = new Date("2026-09-05T09:00:20.000Z").toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    expect(screen.getByText(new RegExp(`computed ${newest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeInTheDocument();
  });
});
