import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { WorkspaceMetricTile } from "../../../src/components/widgets/WorkspaceMetricTile";
import { RequestsAcceptedWidget } from "../../../src/components/widgets/RequestsAcceptedWidget";
import { TotalCostWidget } from "../../../src/components/widgets/TotalCostWidget";
import { ServicedWidget } from "../../../src/components/widgets/ServicedWidget";
import { MeanTimeToResolveWidget } from "../../../src/components/widgets/MeanTimeToResolveWidget";
import { MedianTimeToResolveWidget } from "../../../src/components/widgets/MedianTimeToResolveWidget";
import { useWorkspaceMetrics } from "../../../src/hooks/useWorkspaceMetrics";
import type { WorkspaceMetrics } from "../../../src/models/workspaceMetrics";
import { MOCK_WORKSPACE_METRICS } from "../../../src/test-data/workspaceMetrics";

vi.mock("../../../src/hooks/useWorkspaceMetrics", () => ({ useWorkspaceMetrics: vi.fn() }));
const mockedHook = vi.mocked(useWorkspaceMetrics);

function returns(state: Partial<UseQueryResult<WorkspaceMetrics, Error>>): void {
  mockedHook.mockReturnValue(state as UseQueryResult<WorkspaceMetrics, Error>);
}

const loaded = (data: WorkspaceMetrics) => returns({ data, isPending: false, isError: false });

describe("the live metric widgets", () => {
  it.each([
    [RequestsAcceptedWidget, "411", "Requests accepted: 411, week of Sep 21, ↓ 95% vs. last week"],
    [ServicedWidget, "411", "Serviced: 411, week of Sep 21, ↓ 51% vs. last week"],
    [MeanTimeToResolveWidget, "1h 01m", "Mean time to resolve: 1h 01m, week of Sep 21, ↓ 99% vs. last week"],
    [MedianTimeToResolveWidget, "57m", "Median time to resolve: 57m, week of Sep 21, ↓ 82% vs. last week"],
    [TotalCostWidget, "$421,380", "Total cost: $421,380, week of Sep 21, ↓ 8% vs. last week"],
  ])("renders the latest week with its week-over-week delta", (Widget, value, name) => {
    loaded(MOCK_WORKSPACE_METRICS);
    render(<Widget />);
    expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName(name);
    expect(screen.getByRole("status")).toHaveAttribute("data-tooltip", "week of Sep 21 vs. week of Sep 14");
  });
});

describe("a report missing a widget's column", () => {
  it("shows no data yet for that tile while the others still render", () => {
    loaded({ ...MOCK_WORKSPACE_METRICS, metrics: { ...MOCK_WORKSPACE_METRICS.metrics, TOTAL_COST: { current: null, previous: null } } });
    render(
      <>
        <TotalCostWidget />
        <ServicedWidget />
      </>,
    );
    expect(screen.getByRole("status", { name: "Total cost: no data yet" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /^Serviced: 411/ })).toBeInTheDocument();
  });
});

describe("WorkspaceMetricTile", () => {
  const tile = <WorkspaceMetricTile metricId="SERVICED" label="Serviced" formatValue={String} />;

  it("shows a loading placeholder", () => {
    returns({ isPending: true, isError: false });
    render(tile);
    expect(screen.getByRole("status")).toHaveAccessibleName("Serviced: loading");
  });

  it("shows unavailable on error", () => {
    returns({ isPending: false, isError: true });
    render(tile);
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });

  it("shows no data yet when the report has no value for this metric", () => {
    loaded({ ...MOCK_WORKSPACE_METRICS, metrics: { ...MOCK_WORKSPACE_METRICS.metrics, SERVICED: { current: null, previous: 5 } } });
    render(tile);
    expect(screen.getByRole("status")).toHaveAccessibleName("Serviced: no data yet");
  });

  it("shows no data yet when the job hasn't produced a week", () => {
    loaded({ ...MOCK_WORKSPACE_METRICS, week_start: null });
    render(tile);
    expect(screen.getByText("no data yet")).toBeInTheDocument();
  });

  it("captions with the week when there's no prior week to compare against", () => {
    loaded({
      ...MOCK_WORKSPACE_METRICS,
      previous_week_start: null,
      metrics: { ...MOCK_WORKSPACE_METRICS.metrics, SERVICED: { current: 290, previous: null } },
    });
    render(tile);
    expect(screen.getByText("week of Sep 21")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Serviced: 290, week of Sep 21");
    expect(screen.getByRole("status")).toHaveAttribute("data-tooltip", "week of Sep 21");
  });
});
