import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CapacityManagementPage } from "../../../src/components/pages/CapacityManagementPage";
import { useCapacity } from "../../../src/hooks/useCapacity";
import type { CapacityStatus, Operator } from "../../../src/models/operator";

vi.mock("../../../src/hooks/useCapacity", () => ({ useCapacity: vi.fn() }));

const mockedUseCapacity = vi.mocked(useCapacity);

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

const status: CapacityStatus = { available_count: 1, fleet_size: 1, hourly_burn_rate: 45, roster: [operator] };

function renderPage() {
  return render(
    <MemoryRouter>
      <CapacityManagementPage />
    </MemoryRouter>
  );
}

describe("CapacityManagementPage", () => {
  it("shows a loading state", () => {
    mockedUseCapacity.mockReturnValue({
      status: undefined,
      isLoading: true,
      error: null,
      addCapacity: vi.fn(),
      isAdding: false,
      addError: null,
      removeCapacity: vi.fn(),
      isRemoving: false,
      removeError: null,
    });

    renderPage();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an error state", () => {
    mockedUseCapacity.mockReturnValue({
      status: undefined,
      isLoading: false,
      error: new Error("HTTP 500"),
      addCapacity: vi.fn(),
      isAdding: false,
      addError: null,
      removeCapacity: vi.fn(),
      isRemoving: false,
      removeError: null,
    });

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
  });

  it("renders stats and the roster once status resolves", () => {
    mockedUseCapacity.mockReturnValue({
      status,
      isLoading: false,
      error: null,
      addCapacity: vi.fn(),
      isAdding: false,
      addError: null,
      removeCapacity: vi.fn(),
      isRemoving: false,
      removeError: null,
    });

    renderPage();

    expect(screen.getByText("Available now")).toBeInTheDocument();
    expect(screen.getByText("01OPERATOR")).toBeInTheDocument();
  });

  it("calls addCapacity from the AddCapacityForm", async () => {
    const addCapacity = vi.fn().mockResolvedValue(operator);
    mockedUseCapacity.mockReturnValue({
      status,
      isLoading: false,
      error: null,
      addCapacity,
      isAdding: false,
      addError: null,
      removeCapacity: vi.fn(),
      isRemoving: false,
      removeError: null,
    });

    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Truck 12");
    await user.click(screen.getByRole("button", { name: "Add vehicle" }));

    await waitFor(() => expect(addCapacity).toHaveBeenCalledWith("Truck 12", undefined));
  });

  it("calls removeCapacity from the roster table and clears the removing state afterward", async () => {
    const removeCapacity = vi.fn().mockResolvedValue({ ...operator, status: "INACTIVE" });
    mockedUseCapacity.mockReturnValue({
      status,
      isLoading: false,
      error: null,
      addCapacity: vi.fn(),
      isAdding: false,
      addError: null,
      removeCapacity,
      isRemoving: true,
      removeError: null,
    });

    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove vehicle 01OPERATOR" }));

    await waitFor(() => expect(removeCapacity).toHaveBeenCalledWith("01OPERATOR"));
  });

  it("does not throw when removeCapacity rejects, and shows removeError", async () => {
    const removeCapacity = vi.fn().mockRejectedValue(new Error("not found"));
    mockedUseCapacity.mockReturnValue({
      status,
      isLoading: false,
      error: null,
      addCapacity: vi.fn(),
      isAdding: false,
      addError: null,
      removeCapacity,
      isRemoving: false,
      removeError: new Error("not found"),
    });

    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove vehicle 01OPERATOR" }));

    await waitFor(() => expect(removeCapacity).toHaveBeenCalled());
    expect(screen.getAllByText("not found").length).toBeGreaterThan(0);
  });

  it("links back to /admin", () => {
    mockedUseCapacity.mockReturnValue({
      status,
      isLoading: false,
      error: null,
      addCapacity: vi.fn(),
      isAdding: false,
      addError: null,
      removeCapacity: vi.fn(),
      isRemoving: false,
      removeError: null,
    });

    renderPage();

    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
  });
});
