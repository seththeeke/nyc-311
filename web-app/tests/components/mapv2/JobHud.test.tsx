import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobHud } from "../../../src/components/mapv2/JobHud";
import { timelineAt } from "../../../src/components/mapv2/repairTimeline";
import { IDLE_OPERATOR, WORKING_OPERATOR } from "./fixtures";

describe("JobHud", () => {
  it("shows the job and marks the current step, filling earlier ones", async () => {
    const onExit = vi.fn();
    render(<JobHud operator={WORKING_OPERATOR} script="STREET_REPAIR" timeline={timelineAt("STREET_REPAIR", 8.5)} onExit={onExit} />);
    expect(screen.getByRole("heading", { name: "Street Condition" })).toBeInTheDocument();
    expect(screen.getByText("ORDER-1")).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    const fills = steps.map((li) => (li.querySelector("[style]") as HTMLElement).style.width);
    expect(fills.slice(0, 2)).toEqual(["100%", "100%"]);
    expect(fills[2]).toBe("50%");
    expect(fills[3]).toBe("0%");
    await userEvent.click(screen.getByRole("button", { name: /Back to city/ }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("falls back when the operator has no current order", () => {
    render(<JobHud operator={IDLE_OPERATOR} script="GENERIC" timeline={timelineAt("GENERIC", 0)} onExit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Crew at work" })).toBeInTheDocument();
    expect(screen.getByText("Address unavailable")).toBeInTheDocument();
  });
});
