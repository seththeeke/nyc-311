import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderListTable } from "../../../src/components/orders/OrderListTable";
import type { Order } from "../../../src/models/order";

const order: Order = {
  order_id: "01ORDER",
  request_id: "01REQUEST",
  location_id: "1234567890",
  current_stage: "INGEST",
  status: "CREATED",
  retry_counts: { INGEST: 0, SCHEDULE: 0, EXECUTE: 0, RESOLVE: 0 },
  priority_tier: null,
  sla_deadline: null,
  scheduled_start: null,
  scheduled_end: null,
  assigned_operator_id: null,
  reassignment_count: 0,
  case_id: null,
  created_at: "2026-08-20T15:12:43.894Z",
  updated_at: "2026-08-20T15:12:43.894Z",
  last_event_sequence: 0,
};

describe("OrderListTable", () => {
  it("renders one row per order with its order id, request id, location, stage, and status", () => {
    render(<OrderListTable orders={[order]} />);

    expect(screen.getByText("01ORDER")).toBeInTheDocument();
    expect(screen.getByText("01REQUEST")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
    expect(screen.getByText("INGEST")).toBeInTheDocument();
    expect(screen.getByText("CREATED")).toBeInTheDocument();
  });

  it("renders a table row for every order passed in", () => {
    render(<OrderListTable orders={[order, { ...order, order_id: "02ORDER" }]} />);

    expect(screen.getAllByRole("row")).toHaveLength(3); /* header + 2 data rows */
  });

  it("renders an empty table body when given no orders", () => {
    render(<OrderListTable orders={[]} />);

    expect(screen.getAllByRole("row")).toHaveLength(1); /* header only */
  });
});
