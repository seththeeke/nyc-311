import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddCapacityForm } from "../../../src/components/capacity/AddCapacityForm";

describe("AddCapacityForm", () => {
  it("shows a validation error and does not call onAdd when name is left blank", async () => {
    const onAdd = vi.fn();
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name.");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("calls onAdd with the name and undefined rate when the rate field is left blank", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Truck 12");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 12", undefined));
  });

  it("calls onAdd with the name and entered numeric rate", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Truck 12");
    await user.type(screen.getByLabelText("Rate per hour (optional)"), "60");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 12", 60));
  });

  it("trims whitespace from the name before submitting", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "  Truck 12  ");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("Truck 12", undefined));
  });

  it("clears both fields after a successful add", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
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
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Truck 12");
    await user.type(screen.getByLabelText("Rate per hour (optional)"), "abc");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a positive number");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows a validation error and does not call onAdd for a negative rate", async () => {
    const onAdd = vi.fn();
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Truck 12");
    await user.type(screen.getByLabelText("Rate per hour (optional)"), "-5");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a positive number");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("does not throw out of handleSubmit when onAdd rejects", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("bad rate"));
    render(<AddCapacityForm onAdd={onAdd} isAdding={false} error={null} />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Truck 12");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
  });

  it("disables the submit button while adding", () => {
    render(<AddCapacityForm onAdd={vi.fn()} isAdding={true} error={null} />);

    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
  });

  it("shows the error message when present", () => {
    render(<AddCapacityForm onAdd={vi.fn()} isAdding={false} error={new Error("bad rate")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("bad rate");
  });
});
