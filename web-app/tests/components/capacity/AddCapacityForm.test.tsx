import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddCapacityForm } from "../../../src/components/capacity/AddCapacityForm";
import type { Operator } from "../../../src/models/operator";

function makeOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    operator_id: "op-1",
    name: "Truck 1",
    status: "ACTIVE",
    current_activity: "IDLE",
    removal_requested_at: null,
    start_datetime: "2026-09-01T00:00:00.000Z",
    end_datetime: null,
    rate_per_hour: 45,
    last_event_sequence: 1,
    ...overrides,
  };
}

describe("AddCapacityForm", () => {
  it("calls onAdd with an auto-generated default name when the name field is left blank", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 1", undefined));
  });

  it("increments the default name one past the highest existing 'Truck N' in the roster", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const roster = [makeOperator({ operator_id: "op-1", name: "Truck 3" }), makeOperator({ operator_id: "op-2", name: "Truck 7" })];
    render(<AddCapacityForm roster={roster} onAdd={onAdd} isAdding={false} error={null} />);

    expect(screen.getByLabelText("Name (optional)")).toHaveAttribute("placeholder", "Truck 8");

    await userEvent.setup().click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 8", undefined));
  });

  it("ignores roster names that don't match the 'Truck N' pattern when computing the default", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const roster = [makeOperator({ operator_id: "op-1", name: "Old Reliable" })];
    render(<AddCapacityForm roster={roster} onAdd={onAdd} isAdding={false} error={null} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 1", undefined));
  });

  it("calls onAdd with the entered name when provided", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name (optional)"), "Custom Name");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Custom Name", undefined));
  });

  it("calls onAdd with the name and entered numeric rate", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name (optional)"), "Truck 12");
    await user.type(screen.getByLabelText("Rate per hour (optional)"), "60");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 12", 60));
  });

  it("trims whitespace from the name before submitting", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name (optional)"), "  Truck 12  ");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 12", undefined));
  });

  it("clears both fields after a successful add", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    const nameInput = screen.getByLabelText("Name (optional)") as HTMLInputElement;
    const rateInput = screen.getByLabelText("Rate per hour (optional)") as HTMLInputElement;
    const user = userEvent.setup();
    await user.type(nameInput, "Truck 12");
    await user.type(rateInput, "60");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(nameInput.value).toBe(""));
    expect(rateInput.value).toBe("");
  });

  it("shows a validation error and does not call onAdd for a non-numeric rate", async () => {
    const onAdd = vi.fn();
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name (optional)"), "Truck 12");
    await user.type(screen.getByLabelText("Rate per hour (optional)"), "abc");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a positive number");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows a validation error and does not call onAdd for a negative rate", async () => {
    const onAdd = vi.fn();
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name (optional)"), "Truck 12");
    await user.type(screen.getByLabelText("Rate per hour (optional)"), "-5");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a positive number");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("does not throw out of handleSubmit when onAdd rejects", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("bad rate"));
    render(<AddCapacityForm roster={[]} onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name (optional)"), "Truck 12");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
  });

  it("disables the submit button while adding", () => {
    render(<AddCapacityForm roster={[]} onAdd={vi.fn()} isAdding={true} error={null} />);

    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
  });

  it("shows the error message when present", () => {
    render(<AddCapacityForm roster={[]} onAdd={vi.fn()} isAdding={false} error={new Error("bad rate")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("bad rate");
  });
});
