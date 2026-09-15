import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SqlAutocompleteMenu } from "../../../src/components/query/SqlAutocompleteMenu";

describe("SqlAutocompleteMenu", () => {
  it("renders one option per suggestion", () => {
    render(<SqlAutocompleteMenu suggestions={["order_events", "order_id"]} activeIndex={0} onSelect={vi.fn()} />);

    expect(screen.getByRole("option", { name: "order_events" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "order_id" })).toBeInTheDocument();
  });

  it("marks only the active index as selected", () => {
    render(<SqlAutocompleteMenu suggestions={["order_events", "order_id"]} activeIndex={1} onSelect={vi.fn()} />);

    expect(screen.getByRole("option", { name: "order_events" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("option", { name: "order_id" })).toHaveAttribute("aria-selected", "true");
  });

  it("calls onSelect with the clicked suggestion", async () => {
    const onSelect = vi.fn();
    render(<SqlAutocompleteMenu suggestions={["order_events", "order_id"]} activeIndex={0} onSelect={onSelect} />);

    await userEvent.setup().click(screen.getByRole("option", { name: "order_id" }));

    expect(onSelect).toHaveBeenCalledWith("order_id");
  });
});
