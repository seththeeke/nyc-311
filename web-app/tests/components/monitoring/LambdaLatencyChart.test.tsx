import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LambdaLatencyChart } from "../../../src/components/monitoring/LambdaLatencyChart";
import type { LambdaHealthPoint } from "../../../src/models/lambdaMetrics";

function point(date: string, invocations: number, avg: number | null, max: number | null): LambdaHealthPoint {
  return { date, invocations, errors: 0, successes: invocations, avgDurationMs: avg, maxDurationMs: max };
}

describe("LambdaLatencyChart", () => {
  it("summarizes the week as an invocation-weighted average and the worst single invocation", () => {
    render(<LambdaLatencyChart points={[point("2026-08-21", 3, 100, 400), point("2026-08-22", 1, 20, 50)]} />);
    expect(screen.getByText("80 ms avg · 400 ms max (7d)")).toBeInTheDocument();
    expect(screen.getByText("Avg latency")).toBeInTheDocument();
  });

  it("draws one labelled bar per day, keeping an empty slot for a day with no datapoint", () => {
    render(<LambdaLatencyChart points={[point("2026-08-20", 2, null, null), point("2026-08-21", 2, 42, 812)]} />);
    const bars = screen.getAllByRole("img");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAccessibleName("2026-08-20: no latency data");
    expect(bars[1]).toHaveAccessibleName("2026-08-21: 42 ms average, 812 ms max");
    expect(bars[1]).toHaveAttribute("data-tooltip", "2026-08-21: 42 ms average, 812 ms max");
  });

  it("falls back to the average when a day has no maximum, and to a plain mean when nothing was invoked", () => {
    render(<LambdaLatencyChart points={[point("2026-08-21", 0, 30, null), point("2026-08-22", 0, 50, null)]} />);
    expect(screen.getByText("40 ms avg · 50 ms max (7d)")).toBeInTheDocument();
    expect(screen.getAllByRole("img")[0]).toHaveAccessibleName("2026-08-21: 30 ms average, 30 ms max");
  });

  it("says so when there's no latency data at all", () => {
    render(<LambdaLatencyChart points={[point("2026-08-21", 1, null, null)]} />);
    expect(screen.getByText("No latency data in the last 7 days.")).toBeInTheDocument();
  });
});
