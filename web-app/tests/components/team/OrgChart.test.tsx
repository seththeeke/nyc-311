import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrgChart } from "../../../src/components/team/OrgChart";

describe("OrgChart", () => {
  it("shows the CEO, the Chief of Staff, four executives and the CTO's engineers", () => {
    render(<OrgChart selectedId="cto" onSelect={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("button", { name: /Seth Theeke.*Human/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rex Rivet/ })).toHaveAttribute("aria-pressed", "true");
    const engineers = screen.getByRole("list", { name: "Reports to Rex Rivet" });
    expect(within(engineers).getAllByRole("button").map((button) => button.textContent)).toEqual([
      expect.stringContaining("Pip Sprocketwhistle"),
      expect.stringContaining("Kid Kestrel"),
    ]);
  });

  it("selects a member, and clears the selection on a second press", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<OrgChart selectedId="cto" onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /Penny Platen/ }));
    expect(onSelect).toHaveBeenLastCalledWith("chief-of-staff");
    await user.click(screen.getByRole("button", { name: /Rex Rivet/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
