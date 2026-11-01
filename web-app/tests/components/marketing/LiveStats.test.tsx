import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveStats } from "../../../src/components/marketing/LiveStats";
import { useWorkspaceMetrics } from "../../../src/hooks/useWorkspaceMetrics";
import { useFleetLocations } from "../../../src/hooks/useFleetLocations";

vi.mock("../../../src/hooks/useWorkspaceMetrics", () => ({ useWorkspaceMetrics: vi.fn() }));
vi.mock("../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: vi.fn() }));

const metric = (current: number | null) => ({ current, previous: null });

describe("LiveStats", () => {
  it("shows this week's numbers and how many operators are out on a job", () => {
    vi.mocked(useWorkspaceMetrics).mockReturnValue({
      data: {
        computed_at: "x",
        week_start: "2026-10-26",
        previous_week_start: "2026-10-19",
        metrics: {
          REQUESTS_ACCEPTED: metric(1234),
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
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("987")).toBeInTheDocument();
    expect(screen.getByText("1d 3h")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1 out on a job right now")).toBeInTheDocument();
  });

  it("shows dashes until the API answers", () => {
    vi.mocked(useWorkspaceMetrics).mockReturnValue({ data: undefined } as ReturnType<typeof useWorkspaceMetrics>);
    vi.mocked(useFleetLocations).mockReturnValue({ locations: undefined, isLoading: true, error: null });
    render(<LiveStats reducedMotion={false} />);
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.getByText("On the roster")).toBeInTheDocument();
  });
});
