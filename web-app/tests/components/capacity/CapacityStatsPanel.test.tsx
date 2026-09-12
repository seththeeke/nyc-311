import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapacityStatsPanel } from "../../../src/components/capacity/CapacityStatsPanel";
import type { CapacityStatus } from "../../../src/models/operator";

const status: CapacityStatus = { available_count: 3, fleet_size: 10, hourly_burn_rate: 450, roster: [] };

describe("CapacityStatsPanel", () => {
  it("renders available count, fleet size, and hourly burn rate", () => {
    render(<CapacityStatsPanel status={status} />);

    expect(screen.getByText("Available now")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Fleet size")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Hourly burn rate")).toBeInTheDocument();
    expect(screen.getByText("$450.00/hr")).toBeInTheDocument();
  });
});
