import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { timelineAt } from "../../../src/components/mapv2/repairTimeline";
import { WORKING_OPERATOR } from "./fixtures";

const useDiveRenderer = vi.fn(() => timelineAt("STREET_REPAIR", 0));
vi.mock("../../../src/components/mapv2/useDiveRenderer", () => ({ useDiveRenderer: (...args: unknown[]) => useDiveRenderer(...(args as [])) }));
const { DiveView } = await import("../../../src/components/mapv2/DiveView");

describe("DiveView", () => {
  it("renders the close-up and HUD for the job's script, and exits on Escape", () => {
    const onExit = vi.fn();
    render(<DiveView operator={WORKING_OPERATOR} isLoading={false} theme="DARK" reducedMotion={false} onExit={onExit} />);
    expect(screen.getByRole("img", { name: "Animated close-up of Vehicle 4's job" })).toBeInTheDocument();
    expect(useDiveRenderer).toHaveBeenCalledWith(expect.anything(), "STREET_REPAIR", "DARK", false);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onExit).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("plays the generic script for a job without a complaint type", () => {
    render(<DiveView operator={{ ...WORKING_OPERATOR, current_order: null }} isLoading={false} theme="LIGHT" reducedMotion onExit={vi.fn()} />);
    expect(useDiveRenderer).toHaveBeenLastCalledWith(expect.anything(), "GENERIC", "LIGHT", true);
  });

  it("holds while the fleet loads", () => {
    render(<DiveView operator={undefined} isLoading theme="DARK" reducedMotion={false} onExit={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Finding the crew…");
  });

  it("says when the job is no longer active, with a way back", async () => {
    const onExit = vi.fn();
    render(<DiveView operator={undefined} isLoading={false} theme="DARK" reducedMotion={false} onExit={onExit} />);
    expect(screen.getByRole("alert")).toHaveTextContent("This job isn't active right now");
    await userEvent.click(screen.getByRole("button", { name: "Back to city" }));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
