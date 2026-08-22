import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LambdaHealthChart } from "../../../src/components/monitoring/LambdaHealthChart";
import type { LambdaHealth } from "../../../src/models/lambdaMetrics";

describe("LambdaHealthChart", () => {
  it("renders the lambda's logical name and totals", () => {
    const lambda: LambdaHealth = {
      logicalName: "Poller",
      functionName: "Nyc311Poller-Test",
      points: [
        { date: "2026-08-21", invocations: 4, errors: 0, successes: 4 },
        { date: "2026-08-22", invocations: 3, errors: 0, successes: 3 },
      ],
    };
    render(<LambdaHealthChart lambda={lambda} />);

    expect(screen.getByRole("heading", { name: "Poller" })).toBeInTheDocument();
    expect(screen.getByText("7 invocations · 0 errors (7d)")).toBeInTheDocument();
  });

  it("renders one accessible bar per data point with a descriptive label", () => {
    const lambda: LambdaHealth = {
      logicalName: "OrderFanOut",
      functionName: "Nyc311OrderFanOut-Test",
      points: [{ date: "2026-08-19", invocations: 1008, errors: 1008, successes: 0 }],
    };
    render(<LambdaHealthChart lambda={lambda} />);

    expect(
      screen.getByRole("button", { name: "2026-08-19: 1008 invocations, 0 successes, 1008 errors" })
    ).toBeInTheDocument();
  });

  it("shows a no-data message when there are no points in the window", () => {
    const lambda: LambdaHealth = { logicalName: "RequestEvaluation", functionName: "Nyc311RequestEvaluation-Test", points: [] };
    render(<LambdaHealthChart lambda={lambda} />);

    expect(screen.getByText("No invocations in the last 7 days.")).toBeInTheDocument();
  });
});
