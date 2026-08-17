import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageLayoutToggle } from "../../../src/components/pipeline/StageLayoutToggle";

describe("StageLayoutToggle", () => {
  it("marks the current layout's button as pressed", () => {
    render(<StageLayoutToggle layout="vertical" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Vertical" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Horizontal" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked layout", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StageLayoutToggle layout="vertical" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Horizontal" }));

    expect(onChange).toHaveBeenCalledWith("horizontal");
  });

  it("exposes the control as a labeled group", () => {
    render(<StageLayoutToggle layout="horizontal" onChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Stage layout" })).toBeInTheDocument();
  });
});
