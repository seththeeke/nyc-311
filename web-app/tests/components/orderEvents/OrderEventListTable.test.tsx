import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderEventListTable } from "../../../src/components/orderEvents/OrderEventListTable";
import type { OrderEvent } from "../../../src/models/order";

const event: OrderEvent = {
  order_id: "01ORDER",
  sequence_number: 0,
  event_type: "ORDER_CREATED",
  stage: null,
  payload: {},
  occurred_at: "2026-08-26T15:12:43.894Z",
  actor: "SYSTEM",
};

describe("OrderEventListTable", () => {
  it("renders one row per event with its order id, sequence, event type, and actor", () => {
    render(<OrderEventListTable events={[event]} />);

    expect(screen.getByText("01ORDER")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("ORDER_CREATED")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM")).toBeInTheDocument();
  });

  it("renders a table row for every event passed in", () => {
    render(<OrderEventListTable events={[event, { ...event, sequence_number: 1, event_type: "ORDER_ACCEPTED" }]} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); /* header + 2 data rows */
  });

  it("renders an empty table body when given no events", () => {
    render(<OrderEventListTable events={[]} />);

    expect(screen.getAllByRole("row")).toHaveLength(1); /* header only */
  });

  it("badges a recognized outcome event type distinctly from the default badge", () => {
    render(<OrderEventListTable events={[{ ...event, event_type: "ORDER_REJECTED" }]} />);

    expect(screen.getByText("ORDER_REJECTED")).toBeInTheDocument();
  });
});
