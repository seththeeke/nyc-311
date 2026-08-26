import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderEventMonitoringPage } from "../../../src/components/pages/OrderEventMonitoringPage";
import { orderEventService } from "../../../src/services/orderEventService";
import type { OrderEvent, OrderEventListResponse } from "../../../src/models/order";

vi.mock("../../../src/services/orderEventService", () => ({
  orderEventService: { listOrderEvents: vi.fn() },
}));

const mockedListOrderEvents = vi.mocked(orderEventService.listOrderEvents);

function makeEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    order_id: "01ORDER",
    sequence_number: 0,
    event_type: "ORDER_CREATED",
    stage: null,
    payload: {},
    occurred_at: "2026-08-26T15:12:43.894Z",
    actor: "SYSTEM",
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
        <OrderEventMonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedListOrderEvents.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrderEventMonitoringPage", () => {
  it("shows a loading state, then the heading, filters, and a link back to Monitoring", () => {
    mockedListOrderEvents.mockResolvedValue({ events: [], nextCursor: null });
    renderPage();

    expect(screen.getByRole("heading", { name: "Order Events" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /monitoring/i })).toHaveAttribute("href", "/monitoring");
    expect(screen.getByLabelText("Event type")).toBeInTheDocument();
    expect(screen.getByLabelText("Order ID")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the events table once data resolves", async () => {
    mockedListOrderEvents.mockResolvedValue({ events: [makeEvent()], nextCursor: null });
    renderPage();

    expect(await screen.findByText("01ORDER")).toBeInTheDocument();
  });

  it("shows an empty-state message when no events match the filters", async () => {
    mockedListOrderEvents.mockResolvedValue({ events: [], nextCursor: null });
    renderPage();

    expect(await screen.findByText("No order events match these filters.")).toBeInTheDocument();
  });

  it("shows an error message when the service call fails", async () => {
    mockedListOrderEvents.mockRejectedValue(new Error("HTTP 500"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load order events: HTTP 500");
  });

  it("shows a generic error message for a non-Error rejection", async () => {
    mockedListOrderEvents.mockRejectedValue("boom");
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load order events.");
  });

  it("disables Back on the first page and Next when there's no nextCursor", async () => {
    mockedListOrderEvents.mockResolvedValue({ events: [makeEvent()], nextCursor: null });
    renderPage();

    expect(await screen.findByRole("button", { name: /back/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("advances to the next page's cursor when Next is clicked, and Back returns to the first page", async () => {
    const user = userEvent.setup();
    mockedListOrderEvents.mockResolvedValue({ events: [makeEvent()], nextCursor: "5" });
    renderPage();

    const nextButton = await screen.findByRole("button", { name: /next/i });
    expect(nextButton).toBeEnabled();
    await user.click(nextButton);

    expect(mockedListOrderEvents).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "5" }));

    const backButton = screen.getByRole("button", { name: /back/i });
    expect(backButton).toBeEnabled();
    await user.click(backButton);

    expect(mockedListOrderEvents).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined }));
  });

  it("resets pagination and re-queries with the new filter when an event type is selected", async () => {
    const user = userEvent.setup();
    const response: OrderEventListResponse = { events: [makeEvent()], nextCursor: null };
    mockedListOrderEvents.mockResolvedValue(response);
    renderPage();

    await screen.findByText("01ORDER");
    await user.selectOptions(screen.getByLabelText("Event type"), "ORDER_ACCEPTED");

    expect(mockedListOrderEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ event_type: "ORDER_ACCEPTED", cursor: undefined })
    );
  });

  it("re-queries with the entered order_id filter", async () => {
    const user = userEvent.setup();
    mockedListOrderEvents.mockResolvedValue({ events: [makeEvent()], nextCursor: null });
    renderPage();

    await screen.findByText("01ORDER");
    await user.type(screen.getByLabelText("Order ID"), "X");

    expect(mockedListOrderEvents).toHaveBeenLastCalledWith(expect.objectContaining({ order_id: "X" }));
  });
});
