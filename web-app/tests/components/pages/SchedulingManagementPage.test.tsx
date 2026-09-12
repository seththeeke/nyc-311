import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SchedulingManagementPage } from "../../../src/components/pages/SchedulingManagementPage";
import { useScheduling } from "../../../src/hooks/useScheduling";

vi.mock("../../../src/hooks/useScheduling", () => ({ useScheduling: vi.fn() }));

const mockedUseScheduling = vi.mocked(useScheduling);

function renderPage() {
  return render(
    <MemoryRouter>
      <SchedulingManagementPage />
    </MemoryRouter>
  );
}

describe("SchedulingManagementPage", () => {
  it("links back to /admin", () => {
    mockedUseScheduling.mockReturnValue({ runScheduling: vi.fn(), isRunning: false, error: null, isSuccess: false });

    renderPage();

    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
  });

  it("calls runScheduling when the button is clicked", async () => {
    const runScheduling = vi.fn().mockResolvedValue(undefined);
    mockedUseScheduling.mockReturnValue({ runScheduling, isRunning: false, error: null, isSuccess: false });

    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Run scheduling now" }));

    await waitFor(() => expect(runScheduling).toHaveBeenCalled());
  });

  it("disables and relabels the button while running", () => {
    mockedUseScheduling.mockReturnValue({ runScheduling: vi.fn(), isRunning: true, error: null, isSuccess: false });

    renderPage();

    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
  });

  it("shows a success message once the run completes", () => {
    mockedUseScheduling.mockReturnValue({ runScheduling: vi.fn(), isRunning: false, error: null, isSuccess: true });

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Scheduling run complete.");
  });

  it("shows the error message when present", () => {
    mockedUseScheduling.mockReturnValue({
      runScheduling: vi.fn(),
      isRunning: false,
      error: new Error("HTTP 500"),
      isSuccess: false,
    });

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
  });

  it("does not throw out of handleRun when runScheduling rejects", async () => {
    const runScheduling = vi.fn().mockRejectedValue(new Error("bad request"));
    mockedUseScheduling.mockReturnValue({ runScheduling, isRunning: false, error: null, isSuccess: false });

    renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "Run scheduling now" }));

    await waitFor(() => expect(runScheduling).toHaveBeenCalled());
  });
});
