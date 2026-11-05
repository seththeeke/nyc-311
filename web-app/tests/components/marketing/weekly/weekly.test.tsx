import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { WeeklyStory } from "../../../../src/components/marketing/weekly/WeeklyStory";
import { share, weeklyStats } from "../../../../src/components/marketing/weekly/weeklyStats";
import { CapacityTank } from "../../../../src/components/marketing/weekly/CapacityTank";
import { CostRain } from "../../../../src/components/marketing/weekly/CostRain";
import { GRID_DOTS, RequestGrid } from "../../../../src/components/marketing/weekly/RequestGrid";
import { ResolveClock, handAngle } from "../../../../src/components/marketing/weekly/ResolveClock";
import { useWorkspaceMetrics } from "../../../../src/hooks/useWorkspaceMetrics";
import { useFleetLocations } from "../../../../src/hooks/useFleetLocations";
import type { WorkspaceMetrics } from "../../../../src/models/workspaceMetrics";
import type { FleetLocations } from "../../../../src/models/fleetLocation";

vi.mock("../../../../src/hooks/useWorkspaceMetrics", () => ({ useWorkspaceMetrics: vi.fn() }));
vi.mock("../../../../src/hooks/useFleetLocations", () => ({ useFleetLocations: vi.fn() }));

const SNAPSHOT: WorkspaceMetrics = {
  computed_at: "x",
  week_start: "2026-11-02",
  previous_week_start: "2026-10-26",
  metrics: {
    REQUESTS_ACCEPTED: { current: 200, previous: 150 },
    SERVICED: { current: 150, previous: 100 },
    MEAN_TIME_TO_RESOLVE_HOURS: { current: 30, previous: 60 },
    MEDIAN_TIME_TO_RESOLVE_HOURS: { current: 20, previous: null },
    TOTAL_COST: { current: 52000, previous: 40000 },
  },
};
const op = (id: string, current_activity: "IDLE" | "WORKING" | "TRANSIT") => ({ operator_id: id, name: id, current_activity, current_location: null, recent_job_locations: [], current_order: null });
const FLEET: FleetLocations = { operators: [op("a", "WORKING"), op("b", "TRANSIT"), op("c", "IDLE"), op("d", "IDLE")] };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("weeklyStats and share", () => {
  it("reads the snapshot and the fleet, with week-over-week deltas", () => {
    const stats = weeklyStats(SNAPSHOT, FLEET);
    expect(stats).toMatchObject({ weekLabel: "Nov 2", operators: 4, busy: 2, totalCost: 52000, accepted: 200, serviced: 150, meanHours: 30 });
    expect(stats.costDelta).toBe("↑ 30% vs. last week");
    expect(stats.servicedDelta).toBe("↑ 50% vs. last week");
    expect(stats.meanDelta).toBe("↓ 50% vs. last week");
  });

  it("is all nulls before the API answers", () => {
    const stats = weeklyStats(undefined, undefined);
    expect(Object.values(stats).every((v) => v === null)).toBe(true);
  });

  it("clamps shares and treats unknown or empty wholes as 0", () => {
    expect(share(2, 4)).toBe(0.5);
    expect(share(9, 4)).toBe(1);
    expect(share(null, 4)).toBe(0);
    expect(share(1, null)).toBe(0);
    expect(share(1, 0)).toBe(0);
  });
});

describe("the visuals", () => {
  it("fills the tank to its level only once active", () => {
    const { rerender } = render(<CapacityTank level={0.5} active={false} />);
    expect(screen.getByTestId("tank-level").style.transform).toBe("translateY(92px)");
    rerender(<CapacityTank level={0.5} active={true} />);
    expect(screen.getByTestId("tank-level").style.transform).toBe("translateY(48px)");
  });

  it("rains dollars only while active", () => {
    const { rerender } = render(<CostRain active={false} />);
    expect(screen.queryAllByTestId("dollar")).toHaveLength(0);
    rerender(<CostRain active={true} />);
    expect(screen.getAllByTestId("dollar")).toHaveLength(28);
  });

  it("flips the serviced share of dots green", () => {
    const { container, rerender } = render(<RequestGrid servicedShare={0.75} active={false} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
    rerender(<RequestGrid servicedShare={0.75} active={true} />);
    expect(container.querySelectorAll("li")).toHaveLength(GRID_DOTS);
    expect(container.querySelectorAll("li[data-serviced=true]")).toHaveLength(90);
  });

  it("spins the clock hand twice and settles on the hours of a 24-hour dial", () => {
    expect(handAngle(null)).toBe(0);
    expect(handAngle(6)).toBe(810);
    expect(handAngle(30)).toBe(810);
    const { rerender } = render(<ResolveClock hours={6} active={false} />);
    expect(screen.getByTestId("clock-hand").style.transform).toBe("rotate(0deg)");
    rerender(<ResolveClock hours={6} active={true} />);
    expect(screen.getByTestId("clock-hand").style.transform).toBe("rotate(810deg)");
    expect(screen.getByTestId("clock-arc").style.strokeDashoffset).toBe("0.75");
    rerender(<ResolveClock hours={24} active={true} />);
    expect(screen.getByTestId("clock-arc").style.strokeDashoffset).toBe("0");
  });
});

describe("WeeklyStory", () => {
  let top = 0;
  const mount = (reducedMotion: boolean, snapshot: WorkspaceMetrics | undefined, fleet: FleetLocations | undefined) => {
    vi.mocked(useWorkspaceMetrics).mockReturnValue({ data: snapshot } as ReturnType<typeof useWorkspaceMetrics>);
    vi.mocked(useFleetLocations).mockReturnValue({ locations: fleet, isLoading: false, error: null });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return (this.querySelector("#live-stats-title") ? { top, height: 3200 } : { top: 0, height: 0 }) as DOMRect;
    });
    vi.stubGlobal("innerHeight", 1000);
    return render(<WeeklyStory reducedMotion={reducedMotion} />);
  };

  it("brings each number forward as the section scrolls", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    top = 0;
    const { container } = mount(true, SNAPSHOT, FLEET);
    const current = (): string => container.querySelector("article[data-current=true]")?.textContent ?? "";
    expect(screen.getByText("Here's a view of this week's data, from Nov 2.")).toBeInTheDocument();
    expect(current()).toContain("Capacity");
    expect(current()).toContain("2 out on a job right now");
    const go = (value: number): void => {
      top = value;
      act(() => {
        window.dispatchEvent(new Event("scroll"));
        vi.advanceTimersByTime(20);
      });
    };
    go(-700);
    expect(current()).toContain("$52,000");
    go(-1200);
    expect(current()).toContain("of 200 requests accepted");
    go(-2000);
    expect(current()).toContain("1d 6h");
    expect(screen.getAllByRole("listitem")[3]).toHaveAttribute("aria-current", "step");
    vi.unstubAllGlobals();
  });

  it("shows dashes and plain captions before the API answers", () => {
    top = 0;
    const { container } = mount(false, undefined, undefined);
    expect(screen.getByText("Here's a view of this week's data.")).toBeInTheDocument();
    expect(container.querySelectorAll("article")[0].textContent).toContain("active operators");
    expect(container.querySelectorAll("article")[2].textContent).toContain("requests serviced");
    vi.unstubAllGlobals();
  });
});
