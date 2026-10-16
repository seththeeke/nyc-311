import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperatorCard } from "../../../src/components/mapv2/OperatorCard";
import { IDLE_OPERATOR, WORKING_OPERATOR } from "./fixtures";

describe("OperatorCard", () => {
  it("shows the job and dives into it", async () => {
    const onDive = vi.fn();
    const onClose = vi.fn();
    render(<OperatorCard operator={WORKING_OPERATOR} onDive={onDive} onClose={onClose} diving={false} />);
    expect(screen.getByRole("heading", { name: "Vehicle 4" })).toBeInTheDocument();
    expect(screen.getByText("Working — on a job")).toBeInTheDocument();
    expect(screen.getByText("310 Nostrand Ave, Brooklyn")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dive into job" }));
    await userEvent.click(screen.getByRole("button", { name: "Close vehicle details" }));
    expect(onDive).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables the dive while the camera plunges", () => {
    render(<OperatorCard operator={WORKING_OPERATOR} onDive={vi.fn()} onClose={vi.fn()} diving />);
    expect(screen.getByRole("button", { name: "Diving in…" })).toBeDisabled();
  });

  it("falls back for missing job fields, and offers no dive without a job", () => {
    const sparse = { ...WORKING_OPERATOR, current_order: { order_id: "O", complaint_type: null, location_address: null } };
    const { unmount } = render(<OperatorCard operator={sparse} onDive={vi.fn()} onClose={vi.fn()} diving={false} />);
    expect(screen.getByText("Unspecified job")).toBeInTheDocument();
    expect(screen.getByText("Address unavailable")).toBeInTheDocument();
    unmount();
    render(<OperatorCard operator={IDLE_OPERATOR} onDive={vi.fn()} onClose={vi.fn()} diving={false} />);
    expect(screen.getByText("No job assigned right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dive into job" })).not.toBeInTheDocument();
  });
});
