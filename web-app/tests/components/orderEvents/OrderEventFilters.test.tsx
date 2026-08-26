import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderEventFilters } from "../../../src/components/orderEvents/OrderEventFilters";

describe("OrderEventFilters", () => {
  it("renders a labeled event-type select defaulting to 'All' and an order-id input", () => {
    render(
      <OrderEventFilters eventType="" orderId="" onEventTypeChange={vi.fn()} onOrderIdChange={vi.fn()} />
    );

    expect(screen.getByLabelText("Event type")).toHaveValue("");
    expect(screen.getByLabelText("Order ID")).toHaveValue("");
  });

  it("calls onEventTypeChange with the selected event type", async () => {
    const onEventTypeChange = vi.fn();
    render(
      <OrderEventFilters eventType="" orderId="" onEventTypeChange={onEventTypeChange} onOrderIdChange={vi.fn()} />
    );

    await userEvent.selectOptions(screen.getByLabelText("Event type"), "ORDER_ACCEPTED");

    expect(onEventTypeChange).toHaveBeenCalledWith("ORDER_ACCEPTED");
  });

  it("calls onOrderIdChange as the order-id input changes", async () => {
    const onOrderIdChange = vi.fn();
    render(
      <OrderEventFilters eventType="" orderId="" onEventTypeChange={vi.fn()} onOrderIdChange={onOrderIdChange} />
    );

    await userEvent.type(screen.getByLabelText("Order ID"), "X");

    expect(onOrderIdChange).toHaveBeenCalledWith("X");
  });

  it("reflects the given eventType/orderId values", () => {
    render(
      <OrderEventFilters
        eventType="ORDER_REJECTED"
        orderId="01ORDER"
        onEventTypeChange={vi.fn()}
        onOrderIdChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Event type")).toHaveValue("ORDER_REJECTED");
    expect(screen.getByLabelText("Order ID")).toHaveValue("01ORDER");
  });
});
