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

describe("the metric widgets", () => {
  it.each([
    [RequestsAcceptedWidget, "411", "Requests accepted: 411, week to date from Sep 21, ↓ 95% vs. last week"],
    [ServicedWidget, "411", "Serviced: 411, week to date from Sep 21, ↓ 51% vs. last week"],
    [MeanTimeToResolveWidget, "1h 01m", "Mean time to resolve: 1h 01m, week to date from Sep 21, ↓ 99% vs. last week"],
    [MedianTimeToResolveWidget, "57m", "Median time to resolve: 57m, week to date from Sep 21, ↓ 82% vs. last week"],
    [TotalCostWidget, "$421,380", "Total cost: $421,380, week to date from Sep 21, ↓ 8% vs. last week"],
  ])("renders the week to date with its change against the same days of the week before", (Widget, value, name) => {
    loaded(MOCK_WORKSPACE_METRICS);
    render(<Widget />);
    expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName(name);
    expect(screen.getByRole("status")).toHaveAttribute("data-tooltip", "week to date from Sep 21 vs. the same days of the week before");
  });
});

describe("a metric with no value yet", () => {
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

  it("captions with the week to date when the week before has no value to compare against", () => {
    loaded({ ...MOCK_WORKSPACE_METRICS, metrics: { ...MOCK_WORKSPACE_METRICS.metrics, SERVICED: { current: 0, previous: null } } });
    render(tile);
    expect(screen.getByText("week to date from Sep 21")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Serviced: 0, week to date from Sep 21");
    expect(screen.getByRole("status")).toHaveAttribute("data-tooltip", "week to date from Sep 21");
  });
});
