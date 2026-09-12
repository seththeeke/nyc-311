import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CapacityRosterTable } from "../../../src/components/capacity/CapacityRosterTable";
import type { Operator } from "../../../src/models/operator";

const operator: Operator = {
  operator_id: "01OPERATOR",
  name: "Truck 12",
  status: "ACTIVE",
  current_activity: "IDLE",
  removal_requested_at: null,
  start_datetime: "2026-09-12T00:00:00.000Z",
  end_datetime: null,
  rate_per_hour: 45,
  last_event_sequence: 0,
};

describe("CapacityRosterTable", () => {
  it("shows a message when the roster is empty", () => {
    render(<CapacityRosterTable roster={[]} onRemove={vi.fn()} removingOperatorId={null} />);

    expect(screen.getByText("No active vehicles.")).toBeInTheDocument();
  });

  it("renders one row per Operator with its name, id, activity, rate, and start date", () => {
    render(<CapacityRosterTable roster={[operator]} onRemove={vi.fn()} removingOperatorId={null} />);

    expect(screen.getByText("Truck 12")).toBeInTheDocument();
    expect(screen.getByText("01OPERATOR")).toBeInTheDocument();
    expect(screen.getByText("IDLE")).toBeInTheDocument();
    expect(screen.getByText("$45.00/hr")).toBeInTheDocument();
  });

  it("flags a queued removal", () => {
    const queued = { ...operator, removal_requested_at: "2026-09-12T01:00:00.000Z" };
    render(<CapacityRosterTable roster={[queued]} onRemove={vi.fn()} removingOperatorId={null} />);

    expect(screen.getByText("(removal queued)")).toBeInTheDocument();
  });

  it("calls onRemove with the operator_id when Remove is clicked", async () => {
    const onRemove = vi.fn();
    render(<CapacityRosterTable roster={[operator]} onRemove={onRemove} removingOperatorId={null} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Remove vehicle 01OPERATOR" }));

    expect(onRemove).toHaveBeenCalledWith("01OPERATOR");
  });

  it("disables and relabels the button for the row currently being removed", () => {
    render(<CapacityRosterTable roster={[operator]} onRemove={vi.fn()} removingOperatorId="01OPERATOR" />);

    expect(screen.getByRole("button", { name: "Remove vehicle 01OPERATOR" })).toBeDisabled();
    expect(screen.getByText("Removing…")).toBeInTheDocument();
  });

  it("disables the button for an Operator with a queued removal", () => {
    const queued = { ...operator, removal_requested_at: "2026-09-12T01:00:00.000Z" };
    render(<CapacityRosterTable roster={[queued]} onRemove={vi.fn()} removingOperatorId={null} />);

    expect(screen.getByRole("button", { name: "Remove vehicle 01OPERATOR" })).toBeDisabled();
  });
});
