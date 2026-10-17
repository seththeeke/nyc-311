import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FleetRoster } from "../../../src/components/mapv2/FleetRoster";
import { IDLE_OPERATOR, NO_GPS_OPERATOR, WORKING_OPERATOR } from "./fixtures";

describe("FleetRoster", () => {
  const operators = [IDLE_OPERATOR, WORKING_OPERATOR, NO_GPS_OPERATOR];

  it("lists every vehicle with its activity and job, disabling those without GPS", () => {
    render(<FleetRoster operators={operators} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Roster · 3/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Vehicle 4.*Working · Street Condition/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Vehicle 9.*No GPS fix/ })).toBeDisabled();
  });

  it("selects a vehicle, and deselects the selected one", async () => {
    const onSelect = vi.fn();
    render(<FleetRoster operators={operators} selectedId="OP-W" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /Vehicle 4/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /Vehicle 1/ }));
    await userEvent.click(screen.getByRole("button", { name: /Vehicle 4/ }));
    expect(onSelect.mock.calls).toEqual([["OP-I"], [null]]);
  });

  it("collapses and expands", async () => {
    render(<FleetRoster operators={operators} selectedId={null} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Roster/ }));
    expect(screen.queryByRole("button", { name: /Vehicle 1/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Roster/ }));
    expect(screen.getByRole("button", { name: /Vehicle 1/ })).toBeInTheDocument();
  });
});
