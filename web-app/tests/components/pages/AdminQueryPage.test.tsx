import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminQueryPage } from "../../../src/components/pages/AdminQueryPage";
import { useWarehouseQuery } from "../../../src/hooks/useWarehouseQuery";

vi.mock("../../../src/hooks/useWarehouseQuery", () => ({ useWarehouseQuery: vi.fn() }));

const mockedUseWarehouseQuery = vi.mocked(useWarehouseQuery);

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminQueryPage />
    </MemoryRouter>
  );
}

describe("AdminQueryPage", () => {
  it("links back to /admin", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    renderPage();

    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/admin");
  });

  it("renders the SQL Query heading and console", () => {
    mockedUseWarehouseQuery.mockReturnValue({ runQuery: vi.fn(), result: undefined, isRunning: false, error: null });

    renderPage();

    expect(screen.getByRole("heading", { name: "SQL Query" })).toBeInTheDocument();
    expect(screen.getByLabelText("SQL query")).toBeInTheDocument();
  });
});
