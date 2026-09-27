import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverridesEditor } from "../../../src/components/featureFlags/OverridesEditor";

const override = { entity_type: "OPERATOR" as const, entity_id: "op-1", treatment: "A" };

describe("OverridesEditor", () => {
  it("shows an empty state and adds a row defaulting to the first treatment", async () => {
    const onChange = vi.fn();
    render(<OverridesEditor flagKey="F" overrides={[]} treatments={["A", "B"]} onChange={onChange} />);
    expect(screen.getByText("No overrides.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "+ Add override" }));
    expect(onChange).toHaveBeenCalledWith([{ entity_type: "OPERATOR", entity_id: "", treatment: "A" }]);
  });

  it("adds a row with an empty treatment when none are declared", async () => {
    const onChange = vi.fn();
    render(<OverridesEditor flagKey="F" overrides={[]} treatments={[]} onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "+ Add override" }));
    expect(onChange).toHaveBeenCalledWith([{ entity_type: "OPERATOR", entity_id: "", treatment: "" }]);
  });

  it("edits the entity type, id, and treatment, and removes a row", async () => {
    const onChange = vi.fn();
    render(<OverridesEditor flagKey="F" overrides={[override]} treatments={["A", "B"]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("F override 1 entity id"), { target: { value: " op-2 " } });
    expect(onChange).toHaveBeenLastCalledWith([{ ...override, entity_id: "op-2" }]);

    fireEvent.change(screen.getByLabelText("F override 1 treatment"), { target: { value: "B" } });
    expect(onChange).toHaveBeenLastCalledWith([{ ...override, treatment: "B" }]);

    fireEvent.change(screen.getByLabelText("F override 1 entity type"), { target: { value: "OPERATOR" } });
    expect(onChange).toHaveBeenLastCalledWith([override]);

    await userEvent.setup().click(screen.getByRole("button", { name: "Remove F override 1" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
