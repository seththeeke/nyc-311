import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderFilters } from "../../../src/components/orders/OrderFilters";

describe("OrderFilters", () => {
  it("renders labeled stage and status selects defaulting to 'All'", () => {
    render(<OrderFilters stage="" status="" onStageChange={vi.fn()} onStatusChange={vi.fn()} />);

    expect(screen.getByLabelText("Stage")).toHaveValue("");
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });

  it("calls onStageChange with the selected stage", async () => {
    const onStageChange = vi.fn();
    render(<OrderFilters stage="" status="" onStageChange={onStageChange} onStatusChange={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText("Stage"), "SCHEDULE");

    expect(onStageChange).toHaveBeenCalledWith("SCHEDULE");
  });

  it("calls onStatusChange with the selected status", async () => {
    const onStatusChange = vi.fn();
    render(<OrderFilters stage="" status="" onStageChange={vi.fn()} onStatusChange={onStatusChange} />);

    await userEvent.selectOptions(screen.getByLabelText("Status"), "CREATED");

    expect(onStatusChange).toHaveBeenCalledWith("CREATED");
  });

  it("reflects the given stage/status values as selected", () => {
    render(<OrderFilters stage="EXECUTE" status="CREATED" onStageChange={vi.fn()} onStatusChange={vi.fn()} />);

    expect(screen.getByLabelText("Stage")).toHaveValue("EXECUTE");
    expect(screen.getByLabelText("Status")).toHaveValue("CREATED");
  });
});
