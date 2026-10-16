import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CameraControls } from "../../../src/components/mapv2/CameraControls";

describe("CameraControls", () => {
  it("wires every labelled button to its camera action", async () => {
    const actions = { zoomIn: vi.fn(), zoomOut: vi.fn(), rotate: vi.fn(), toggleTilt: vi.fn(), resetView: vi.fn() };
    render(<CameraControls actions={actions} />);
    expect(screen.getByRole("toolbar", { name: "Camera" })).toBeInTheDocument();
    /* No native title, so the shell's TooltipLayer (which skips titled elements) shows the label on hover. */
    expect(screen.getAllByRole("button").every((b) => !b.hasAttribute("title"))).toBe(true);
    for (const name of ["Zoom in", "Zoom out", "Rotate left", "Rotate right", "Toggle 3-D tilt", "Reset to city overview"]) {
      await userEvent.click(screen.getByRole("button", { name }));
    }
    expect(actions.zoomIn).toHaveBeenCalledOnce();
    expect(actions.zoomOut).toHaveBeenCalledOnce();
    expect(actions.rotate.mock.calls).toEqual([[-45], [45]]);
    expect(actions.toggleTilt).toHaveBeenCalledOnce();
    expect(actions.resetView).toHaveBeenCalledOnce();
  });
});
