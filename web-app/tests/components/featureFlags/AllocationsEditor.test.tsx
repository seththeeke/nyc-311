import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllocationsEditor } from "../../../src/components/featureFlags/AllocationsEditor";

describe("AllocationsEditor", () => {
  it("shows the default's remaining share", () => {
    render(<AllocationsEditor flagKey="F" allocations={[{ treatment: "B", percent: 30 }]} treatments={["A", "B"]} defaultTreatment="A" onChange={vi.fn()} />);
    expect(screen.getByText("Default (A) gets 70%")).toBeInTheDocument();
  });

  it("flags an over-allocated split and an unset default", () => {
    render(
      <AllocationsEditor
        flagKey="F"
        allocations={[{ treatment: "B", percent: 80 }, { treatment: "A", percent: 40 }]}
        treatments={["A", "B"]}
        defaultTreatment=""
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Default (unset) gets -20%")).toHaveClass("text-danger");
  });

  it("adds, edits, blanks, and removes a split", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<AllocationsEditor flagKey="F" allocations={[]} treatments={[]} defaultTreatment="A" onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "+ Add split" }));
    expect(onChange).toHaveBeenLastCalledWith([{ treatment: "", percent: 10 }]);

    const row = { treatment: "A", percent: 10 };
    rerender(<AllocationsEditor flagKey="F" allocations={[row]} treatments={["A", "B"]} defaultTreatment="A" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("F allocation 1 percent"), { target: { value: "25" } });
    expect(onChange).toHaveBeenLastCalledWith([{ treatment: "A", percent: 25 }]);
    fireEvent.change(screen.getByLabelText("F allocation 1 percent"), { target: { value: "" } });
    expect(Number.isNaN(onChange.mock.lastCall?.[0][0].percent)).toBe(true);
    fireEvent.change(screen.getByLabelText("F allocation 1 treatment"), { target: { value: "B" } });
    expect(onChange).toHaveBeenLastCalledWith([{ treatment: "B", percent: 10 }]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove F allocation 1" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("renders a blank input for a NaN percent", () => {
    render(<AllocationsEditor flagKey="F" allocations={[{ treatment: "A", percent: Number.NaN }]} treatments={["A"]} defaultTreatment="A" onChange={vi.fn()} />);
    expect(screen.getByLabelText("F allocation 1 percent")).toHaveValue(null);
  });
});
