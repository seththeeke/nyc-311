import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveStats } from "../../../src/components/marketing/LiveStats";
import { useWorkspaceMetrics } from "../../../src/hooks/useWorkspaceMetrics";
import { useFleetLocations } from "../../../src/hooks/useFleetLocations";

vi.mock("../../../src/hooks/useWorkspaceMetrics", () => ({ useWorkspaceMetrics: vi.fn() }));
vi.mock("../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: vi.fn() }));

const metric = (current: number | null) => ({ current, previous: null });

describe("LiveStats", () => {
  it("mirrors the map workspace's six snapshot tiles, with their week-over-week deltas", () => {
    vi.mocked(useWorkspaceMetrics).mockReturnValue({
      data: {
        computed_at: "x",
        week_start: "2026-10-26",
        previous_week_start: "2026-10-19",
        metrics: {
          REQUESTS_ACCEPTED: { current: 1234, previous: 1000 },
          SERVICED: metric(987),
          MEAN_TIME_TO_RESOLVE_HOURS: metric(30),
          MEDIAN_TIME_TO_RESOLVE_HOURS: metric(26.5),
          TOTAL_COST: metric(1000),
        },
      },
    } as ReturnType<typeof useWorkspaceMetrics>);
    vi.mocked(useFleetLocations).mockReturnValue({
      locations: {
        operators: [
          { operator_id: "a", name: "A", current_activity: "WORKING", current_location: null, recent_job_locations: [], current_order: null },
          { operator_id: "b", name: "B", current_activity: "IDLE", current_location: null, recent_job_locations: [], current_order: null },
        ],
      },
      isLoading: false,
      error: null,
    });
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<LiveStats reducedMotion={true} />);
    vi.unstubAllGlobals();
    for (const label of ["Capacity", "Requests Accepted", "Serviced", "Total Cost (Est.)", "Mean Time to Resolve", "Median Time to Resolve"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("987")).toBeInTheDocument();
    expect(screen.getByText("$1,000")).toBeInTheDocument();
    expect(screen.getByText("1d 6h")).toBeInTheDocument();
    expect(screen.getByText("1d 3h")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("active operators")).toBeInTheDocument();
    expect(screen.getByText("↑ 23% vs. last week")).toBeInTheDocument();
    expect(screen.getAllByText("week to date from Oct 26")).toHaveLength(4);
    expect(screen.getByText(/The fleet map's own weekly snapshot, week to date from Oct 26/)).toBeInTheDocument();
  });

  it("shows dashes until the API answers", () => {
    vi.mocked(useWorkspaceMetrics).mockReturnValue({ data: undefined } as ReturnType<typeof useWorkspaceMetrics>);
    vi.mocked(useFleetLocations).mockReturnValue({ locations: undefined, isLoading: true, error: null });
    render(<LiveStats reducedMotion={false} />);
    expect(screen.getAllByText("—")).toHaveLength(6);
    expect(screen.getAllByText("this week")).toHaveLength(5);
  });
});
