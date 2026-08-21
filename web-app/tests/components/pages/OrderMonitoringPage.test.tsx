import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderMonitoringPage } from "../../../src/components/pages/OrderMonitoringPage";
import { orderService } from "../../../src/services/orderService";
import type { Order, OrderListResponse } from "../../../src/models/order";

vi.mock("../../../src/services/orderService", () => ({
  orderService: { listOrders: vi.fn() },
}));

const mockedListOrders = vi.mocked(orderService.listOrders);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
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
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrderMonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedListOrders.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrderMonitoringPage", () => {
  it("shows a loading state, then the heading, filters, and a link back to Monitoring", () => {
    mockedListOrders.mockResolvedValue({ orders: [], nextCursor: null });
    renderPage();

    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    expect(screen.getByLabelText("Stage")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the orders table once data resolves", async () => {
    mockedListOrders.mockResolvedValue({ orders: [makeOrder()], nextCursor: null });
    renderPage();

    expect(await screen.findByText("01ORDER")).toBeInTheDocument();
  });

  it("shows an empty-state message when no orders match the filters", async () => {
    mockedListOrders.mockResolvedValue({ orders: [], nextCursor: null });
    renderPage();

    expect(await screen.findByText("No orders match these filters.")).toBeInTheDocument();
  });

  it("shows an error message when the service call fails", async () => {
    mockedListOrders.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load orders: HTTP 500");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedListOrders.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load orders.");
  });

  it("disables Back on the first page and Next when there's no nextCursor", async () => {
    mockedListOrders.mockResolvedValue({ orders: [makeOrder()], nextCursor: null });
    renderPage();

    expect(await screen.findByRole("button", { name: /back/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("advances to the next page's cursor when Next is clicked, and Back returns to the first page", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue({ orders: [makeOrder()], nextCursor: "5" });
    renderPage();

    const nextButton = await screen.findByRole("button", { name: /next/i });
    expect(nextButton).toBeEnabled();
    await user.click(nextButton);

    expect(mockedListOrders).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "5" }));

    const backButton = screen.getByRole("button", { name: /back/i });
    expect(backButton).toBeEnabled();
    await user.click(backButton);

    expect(mockedListOrders).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }));
  });

  it("resets pagination and re-queries with the new filter when a stage is selected", async () => {
    const user = userEvent.setup();
    const response: OrderListResponse = { orders: [makeOrder()], nextCursor: null };
    mockedListOrders.mockResolvedValue(response);
    renderPage();

    await screen.findByText("01ORDER");
    await user.selectOptions(screen.getByLabelText("Stage"), "SCHEDULE");

    expect(mockedListOrders).toHaveBeenLastCalledWith(expect.objectContaining({ stage: "SCHEDULE", cursor: undefined }));
  });

  it("re-queries with the selected status filter", async () => {
    const user = userEvent.setup();
    mockedListOrders.mockResolvedValue({ orders: [makeOrder()], nextCursor: null });
    renderPage();

    await screen.findByText("01ORDER");
    await user.selectOptions(screen.getByLabelText("Status"), "CREATED");

    expect(mockedListOrders).toHaveBeenLastCalledWith(expect.objectContaining({ status: "CREATED" }));
  });
});
